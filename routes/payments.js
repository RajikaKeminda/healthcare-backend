const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { verifyToken, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Simulate payment gateway
const simulatePaymentGateway = async (paymentData) => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate 95% success rate
  const isSuccess = Math.random() > 0.05;
  
  if (isSuccess) {
    return {
      success: true,
      gatewayTransactionId: `GW${Date.now()}${Math.floor(Math.random() * 1000)}`,
      gatewayStatus: 'approved',
      gatewayMessage: 'Payment processed successfully'
    };
  } else {
    return {
      success: false,
      gatewayTransactionId: null,
      gatewayStatus: 'declined',
      gatewayMessage: 'Payment declined by bank'
    };
  }
};

// Get all payments with filtering and pagination
router.get('/', verifyToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
  query('method').optional().isIn(['credit_card', 'debit_card', 'cash', 'insurance', 'government', 'bank_transfer', 'digital_wallet']),
  query('patientID').optional().isMongoId().withMessage('Invalid patient ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter based on user role
    let filter = {};
    
    if (req.user.role === 'patient') {
      filter.patientID = req.user._id;
    }

    // Add query filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.method) filter.method = req.query.method;
    if (req.query.patientID) filter.patientID = req.query.patientID;

    const payments = await Payment.find(filter)
      .populate('patientID', 'userName email phone')
      .populate('appointmentID', 'appointmentID date time')
      .populate('hospitalID', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Process payment
router.post('/', verifyToken, [
  body('appointmentID').optional().isMongoId().withMessage('Invalid appointment ID'),
  body('hospitalID').isMongoId().withMessage('Invalid hospital ID'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('method').isIn(['credit_card', 'debit_card', 'cash', 'insurance', 'government', 'bank_transfer', 'digital_wallet']).withMessage('Invalid payment method'),
  body('billingDetails.services').isArray().withMessage('Services must be an array'),
  body('billingDetails.services.*.serviceName').notEmpty().withMessage('Service name is required'),
  body('billingDetails.services.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('billingDetails.services.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { appointmentID, hospitalID, amount, method, billingDetails, insuranceInfo, patientID } = req.body;

    const paymentID = uuidv4();
    const _patientID = patientID || req.user._id;
    
    // Create payment record
    const payment = new Payment({
      paymentID,
      patientID: _patientID,
      appointmentID,
      hospitalID,
      amount,
      method,
      billingDetails,
      insuranceInfo,
      status: 'pending'
    });

    // Calculate total from services
    payment.calculateTotal();

    // Process payment based on method
    if (method === 'cash') {
      // Cash payments are immediately completed
      payment.status = 'completed';
      payment.processedBy = req.user._id;
    } else if (method === 'insurance') {
      // Insurance payments are pending until claim is processed
      payment.status = 'pending';
      payment.insuranceInfo.status = 'pending';
    } else if (method === 'government') {
      // Government payments are immediately completed
      payment.status = 'completed';
    } else {
      // Process through payment gateway
      payment.status = 'processing';
      await payment.save();

      const gatewayResponse = await simulatePaymentGateway(payment);
      
      if (gatewayResponse.success) {
        payment.status = 'completed';
        payment.gatewayResponse = {
          gateway: 'simulated_gateway',
          gatewayTransactionId: gatewayResponse.gatewayTransactionId,
          gatewayStatus: gatewayResponse.gatewayStatus,
          gatewayMessage: gatewayResponse.gatewayMessage,
          processedAt: new Date()
        };
      } else {
        payment.status = 'failed';
        payment.gatewayResponse = {
          gateway: 'simulated_gateway',
          gatewayStatus: gatewayResponse.gatewayStatus,
          gatewayMessage: gatewayResponse.gatewayMessage,
          processedAt: new Date()
        };
      }
    }

    await payment.save();

    // Update appointment payment status if applicable
    if (appointmentID) {
      const appointment = await Appointment.findById(appointmentID);
      if (appointment) {
        if (payment.amount === appointment.reservationFee.amount) {
          appointment.reservationFee.paid = payment.status === 'completed';
          appointment.reservationFee.paymentDate = payment.status === 'completed' ? new Date() : null;
          appointment.reservationFee.paymentMethod = payment.method;
        } else {
          appointment.consultationFee.paid = payment.status === 'completed';
          appointment.consultationFee.paymentDate = payment.status === 'completed' ? new Date() : null;
          appointment.consultationFee.paymentMethod = payment.method;
        }
        await appointment.save();
      }
    }

    // Populate payment data
    await payment.populate('patientID', 'userName email phone');
    await payment.populate('appointmentID', 'appointmentID date time');
    await payment.populate('hospitalID', 'name address');

    res.status(201).json({
      success: true,
      message: payment.status === 'completed' ? 'Payment processed successfully' : 'Payment is being processed',
      data: { payment }
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update payment (for staff to process payments)
router.put('/:paymentID', verifyToken, authorize('hospital_staff', 'healthcare_manager'), [
  body('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentID } = req.params;
    const updates = req.body;

    const payment = await Payment.findById(paymentID);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    Object.keys(updates).forEach(key => {
      payment[key] = updates[key];
    });

    if (updates.status === 'completed') {
      payment.processedBy = req.user._id;
    }

    await payment.save();

    await payment.populate('patientID', 'userName email phone');
    await payment.populate('appointmentID', 'appointmentID date time');
    await payment.populate('hospitalID', 'name address');

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get payment by ID
router.get('/:paymentID', verifyToken, async (req, res) => {
  try {
    const { paymentID } = req.params;

    const payment = await Payment.findById(paymentID)
      .populate('patientID', 'userName email phone')
      .populate('appointmentID', 'appointmentID date time')
      .populate('hospitalID', 'name address');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && payment.patientID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Generate receipt
router.post('/:paymentID/receipt', verifyToken, [
  body('format').optional().isIn(['pdf', 'html']).withMessage('Format must be pdf or html')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentID } = req.params;
    const { format = 'pdf' } = req.body;

    const payment = await Payment.findById(paymentID)
      .populate('patientID', 'userName email phone address')
      .populate('appointmentID', 'appointmentID date time')
      .populate('hospitalID', 'name address contactInfo');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && payment.patientID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if payment is completed
    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Receipt can only be generated for completed payments'
      });
    }

    // Generate receipt number if not exists
    if (!payment.receipt.receiptNumber) {
      const count = await Payment.countDocuments({ 'receipt.receiptNumber': { $exists: true } });
      payment.receipt.receiptNumber = `RCP${String(count + 1).padStart(6, '0')}`;
      payment.receipt.generated = true;
      payment.receipt.generatedAt = new Date();
      await payment.save();
    }

    // For now, return receipt data (in production, you would generate actual PDF/HTML)
    const receiptData = {
      receiptNumber: payment.receipt.receiptNumber,
      paymentDate: payment.createdAt,
      patient: payment.patientID,
      hospital: payment.hospitalID,
      appointment: payment.appointmentID,
      services: payment.billingDetails.services,
      subtotal: payment.billingDetails.subtotal,
      tax: payment.billingDetails.tax,
      discount: payment.billingDetails.discount,
      total: payment.billingDetails.total,
      paymentMethod: payment.method,
      transactionReference: payment.transactionReference,
      status: payment.status
    };

    res.json({
      success: true,
      message: 'Receipt generated successfully',
      data: { receipt: receiptData }
    });

  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Process refund
router.post('/:paymentID/refund', verifyToken, authorize('hospital_staff', 'healthcare_manager'), [
  body('refundAmount').isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  body('refundReason').notEmpty().withMessage('Refund reason is required'),
  body('refundMethod').isIn(['original', 'cash', 'bank_transfer']).withMessage('Invalid refund method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentID } = req.params;
    const { refundAmount, refundReason, refundMethod } = req.body;

    const payment = await Payment.findById(paymentID);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed payments'
      });
    }

    if (refundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed payment amount'
      });
    }

    // Update payment with refund information
    payment.refund = {
      refundAmount,
      refundReason,
      refundedAt: new Date(),
      refundMethod,
      refundReference: `REF${Date.now()}${Math.floor(Math.random() * 1000)}`
    };

    if (refundAmount === payment.amount) {
      payment.status = 'refunded';
    } else {
      payment.status = 'partially_refunded';
    }

    await payment.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
