const Payment = require('../../../models/Payment');
const { createTestUser, createTestHospital, createTestAppointment } = require('../../utils/testHelpers');

require('../../setup');

describe('Payment Model', () => {
  let patient, hospital, appointment;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    const doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    appointment = await createTestAppointment(patient, doctor, hospital);
  });

  describe('Payment Creation', () => {
    it('should create a valid payment with required fields', async () => {
      const paymentData = {
        paymentID: 'PAY001',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'completed',
        transactionReference: 'TXN001',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      };

      const payment = await Payment.create(paymentData);

      expect(payment).toBeDefined();
      expect(payment.paymentID).toBe('PAY001');
      expect(payment.amount).toBe(2000);
      expect(payment.method).toBe('cash');
      expect(payment.status).toBe('completed');
    });

    it('should fail without required fields', async () => {
      const paymentData = {
        paymentID: 'PAY002',
        // Missing required fields
      };

      await expect(Payment.create(paymentData)).rejects.toThrow();
    });

    it('should generate unique paymentID', async () => {
      const paymentData = {
        paymentID: 'PAY003',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN003',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      };

      await Payment.create(paymentData);

      // Try to create duplicate
      await expect(Payment.create(paymentData)).rejects.toThrow();
    });

    it('should set default status to pending', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY004',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN004',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.status).toBe('pending');
    });

    it('should validate payment method enum', async () => {
      const paymentData = {
        paymentID: 'PAY005',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'invalid_method',
        transactionReference: 'TXN005',
      };

      await expect(Payment.create(paymentData)).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const paymentData = {
        paymentID: 'PAY006',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'invalid_status',
        transactionReference: 'TXN006',
      };

      await expect(Payment.create(paymentData)).rejects.toThrow();
    });

    it('should require positive amount', async () => {
      const paymentData = {
        paymentID: 'PAY007',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: -1000,
        method: 'cash',
        transactionReference: 'TXN007',
      };

      await expect(Payment.create(paymentData)).rejects.toThrow();
    });
  });

  describe('Payment with Appointment', () => {
    it('should link payment to appointment', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY008',
        patientID: patient._id,
        appointmentID: appointment._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN008',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.appointmentID.toString()).toBe(appointment._id.toString());
    });

    it('should populate appointment details', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY009',
        patientID: patient._id,
        appointmentID: appointment._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN009',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      const populated = await Payment.findById(payment._id)
        .populate('appointmentID', 'appointmentID date time');

      expect(populated.appointmentID.appointmentID).toBeDefined();
      expect(populated.appointmentID.date).toBeDefined();
    });
  });

  describe('Billing Details', () => {
    it('should store billing details with services', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY010',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2500,
        method: 'credit_card',
        transactionReference: 'TXN010',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }, {
            serviceName: 'Lab Test',
            unitPrice: 500,
            quantity: 1,
            totalPrice: 500,
          }],
          subtotal: 2500,
          tax: 0,
          discount: 0,
          total: 2500,
        },
      });

      expect(payment.billingDetails.services).toHaveLength(2);
      expect(payment.billingDetails.subtotal).toBe(2500);
      expect(payment.billingDetails.total).toBe(2500);
    });

    it('should calculate total with tax and discount', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY011',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2100,
        method: 'cash',
        transactionReference: 'TXN011',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 200,
          discount: 100,
          total: 2100,
        },
      });

      expect(payment.billingDetails.tax).toBe(200);
      expect(payment.billingDetails.discount).toBe(100);
      expect(payment.billingDetails.total).toBe(2100);
    });
  });

  describe('Insurance Information', () => {
    it('should store insurance details for insurance payments', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY012',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'insurance',
        transactionReference: 'TXN012',
        insuranceInfo: {
          provider: 'Test Insurance Co.',
          policyNumber: 'POL123456',
          claimNumber: 'CLM789012',
          coveredAmount: 1500,
          patientResponsibility: 500,
        },
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.insuranceInfo.provider).toBe('Test Insurance Co.');
      expect(payment.insuranceInfo.policyNumber).toBe('POL123456');
      expect(payment.insuranceInfo.coveredAmount).toBe(1500);
      expect(payment.insuranceInfo.patientResponsibility).toBe(500);
    });
  });

  describe('Receipt Generation', () => {
    it('should store receipt number', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY013',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'completed',
        transactionReference: 'TXN013',
        receiptNumber: 'RCP2024001',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.receiptNumber).toBe('RCP2024001');
    });
  });

  describe('Refunds', () => {
    it('should store refund information', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY014',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'completed',
        transactionReference: 'TXN014',
        refundInfo: {
          amount: 500,
          reason: 'Partial refund requested',
          status: 'processed',
          processedAt: new Date(),
        },
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.refundInfo.amount).toBe(500);
      expect(payment.refundInfo.reason).toBe('Partial refund requested');
      expect(payment.refundInfo.status).toBe('processed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const largeAmount = 1000000;
      const payment = await Payment.create({
        paymentID: 'PAY015',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: largeAmount,
        method: 'bank_transfer',
        transactionReference: 'TXN015',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.amount).toBe(largeAmount);
    });

    it('should handle decimal amounts', async () => {
      const decimalAmount = 2499.99;
      const payment = await Payment.create({
        paymentID: 'PAY016',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: decimalAmount,
        method: 'cash',
        transactionReference: 'TXN016',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.amount).toBe(decimalAmount);
    });

    it('should handle long transaction references', async () => {
      const longRef = 'TXN' + 'X'.repeat(100);
      const payment = await Payment.create({
        paymentID: 'PAY017',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: longRef,
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      expect(payment.transactionReference).toBe(longRef);
    });

    it('should handle multiple services', async () => {
      const services = Array(10).fill(null).map((_, i) => ({
        serviceName: `Service ${i + 1}`,
        unitPrice: 100,
        quantity: 1,
        totalPrice: 100,
      }));

      const payment = await Payment.create({
        paymentID: 'PAY018',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 1000,
        method: 'cash',
        transactionReference: 'TXN018',
        billingDetails: {
          services,
          subtotal: 1000,
          tax: 0,
          discount: 0,
          total: 1000,
        },
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
      });

      expect(payment.billingDetails.services).toHaveLength(10);
    });
  });

  describe('References', () => {
    it('should populate patient details', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY019',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN019',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      const populated = await Payment.findById(payment._id)
        .populate('patientID', 'userName email phone');

      expect(populated.patientID.userName).toBe(patient.userName);
      expect(populated.patientID.email).toBe(patient.email);
    });

    it('should populate hospital details', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY020',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        transactionReference: 'TXN020',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      const populated = await Payment.findById(payment._id)
        .populate('hospitalID', 'name address');

      expect(populated.hospitalID.name).toBe(hospital.name);
      expect(populated.hospitalID.address).toBeDefined();
    });
  });

  describe('Payment Status Updates', () => {
    it('should update payment status', async () => {
      const payment = await Payment.create({
        paymentID: 'PAY021',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'pending',
        transactionReference: 'TXN021',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      payment.status = 'completed';
      await payment.save();

      const updated = await Payment.findById(payment._id);
      expect(updated.status).toBe('completed');
    });

    it('should track who processed the payment', async () => {
      const staff = await createTestUser('hospital_staff');
      const payment = await Payment.create({
        paymentID: 'PAY022',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'pending',
        transactionReference: 'TXN022',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      });

      payment.status = 'completed';
      payment.processedBy = staff._id;
      await payment.save();

      const updated = await Payment.findById(payment._id);
      expect(updated.processedBy.toString()).toBe(staff._id.toString());
    });
  });
});

