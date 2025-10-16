const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Appointment = require('../models/Appointment');
const HealthcareProfessional = require('../models/HealthcareProfessional');
const Hospital = require('../models/Hospital');
const { verifyToken, authorize, authorizeResource } = require('../middleware/auth');

const router = express.Router();

// Get all appointments with filtering and pagination
router.get('/', verifyToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  query('date').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('doctorID').optional().isMongoId().withMessage('Invalid doctor ID'),
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
    } else if (req.user.role === 'healthcare_professional') {
      filter.doctorID = req.user._id;
    }

    // Add query filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const date = new Date(req.query.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: date, $lt: nextDay };
    }
    if (req.query.doctorID) filter.doctorID = req.query.doctorID;
    if (req.query.patientID) filter.patientID = req.query.patientID;

    const appointments = await Appointment.find(filter)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address')
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get available time slots for a doctor on a specific date
router.get('/availability/:doctorID', verifyToken, [
  query('date').isISO8601().withMessage('Date must be in ISO format')
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

    const { doctorID } = req.params;
    const { date } = req.query;

    const doctor = await HealthcareProfessional.findById(doctorID);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get existing appointments for the date
    const existingAppointments = await Appointment.find({
      doctorID,
      date: new Date(date),
      status: { $in: ['scheduled', 'confirmed'] }
    }).select('time duration');

    // Generate available time slots (assuming 30-minute slots from 9 AM to 5 PM)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 17;
    const slotDuration = 30; // minutes

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if this slot conflicts with existing appointments
        const isBooked = existingAppointments.some(apt => {
          const aptTime = apt.time;
          const aptEndTime = new Date(`2000-01-01 ${aptTime}`);
          aptEndTime.setMinutes(aptEndTime.getMinutes() + apt.duration);
          
          const slotTime = new Date(`2000-01-01 ${timeSlot}`);
          const slotEndTime = new Date(slotTime);
          slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);
          
          return (slotTime < aptEndTime && slotEndTime > new Date(`2000-01-01 ${aptTime}`));
        });

        if (!isBooked) {
          availableSlots.push(timeSlot);
        }
      }
    }

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.userName,
          specialization: doctor.specialization
        },
        date,
        availableSlots
      }
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new appointment
router.post('/', verifyToken, authorize('patient'), [
  body('doctorID').isMongoId().withMessage('Invalid doctor ID'),
  body('hospitalID').isMongoId().withMessage('Invalid hospital ID'),
  body('date').isISO8601().withMessage('Date must be in ISO format'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('type').optional().isIn(['regular', 'urgent', 'follow_up', 'consultation', 'procedure']),
  body('symptoms').optional().isArray(),
  body('notes').optional().isLength({ max: 1000 })
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

    const { doctorID, hospitalID, date, time, type = 'regular', symptoms = [], notes } = req.body;

    // Verify doctor exists and is available
    const doctor = await HealthcareProfessional.findById(doctorID);
    if (!doctor || !doctor.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not available'
      });
    }

    // Verify hospital exists
    const hospital = await Hospital.findById(hospitalID);
    if (!hospital) {
      return res.status(400).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Check if appointment slot is available
    const existingAppointment = await Appointment.findOne({
      doctorID,
      date: new Date(date),
      time,
      status: { $in: ['scheduled', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      patientID: req.user._id,
      doctorID,
      hospitalID,
      date: new Date(date),
      time,
      type,
      symptoms,
      notes,
      reservationFee: {
        amount: doctor.consultationFee * 0.2 // 20% reservation fee
      }
    });

    await appointment.save();

    // Populate the appointment data
    await appointment.populate('patientID', 'userName email phone');
    await appointment.populate('doctorID', 'userName email specialization');
    await appointment.populate('hospitalID', 'name address');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update appointment
router.put('/:appointmentID', verifyToken, [
  body('date').optional().isISO8601().withMessage('Date must be in ISO format'),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('status').optional().isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
  body('notes').optional().isLength({ max: 1000 })
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

    const { appointmentID } = req.params;
    const updates = req.body;

    // Find appointment
    const appointment = await Appointment.findById(appointmentID);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && appointment.patientID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && appointment.doctorID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update appointment
    Object.keys(updates).forEach(key => {
      if (key === 'date') {
        appointment[key] = new Date(updates[key]);
      } else {
        appointment[key] = updates[key];
      }
    });

    await appointment.save();

    // Populate the appointment data
    await appointment.populate('patientID', 'userName email phone');
    await appointment.populate('doctorID', 'userName email specialization');
    await appointment.populate('hospitalID', 'name address');

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Cancel appointment
router.put('/:appointmentID/cancel', verifyToken, [
  body('reason').notEmpty().withMessage('Cancellation reason is required')
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

    const { appointmentID } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(appointmentID);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && appointment.patientID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed appointment'
      });
    }

    // Update appointment status
    appointment.status = 'cancelled';
    appointment.cancellation = {
      cancelledBy: req.user.role,
      reason,
      cancelledAt: new Date()
    };

    // Calculate refund (if reservation fee was paid)
    if (appointment.reservationFee.paid) {
      appointment.cancellation.refundAmount = appointment.reservationFee.amount * 0.8; // 80% refund
      appointment.cancellation.refundStatus = 'pending';
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get appointment by ID
router.get('/:appointmentID', verifyToken, async (req, res) => {
  try {
    const { appointmentID } = req.params;

    const appointment = await Appointment.findById(appointmentID)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && appointment.patientID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && appointment.doctorID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { appointment }
    });

  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
