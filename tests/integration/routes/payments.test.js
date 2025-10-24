const request = require('supertest');
const app = require('../../../app');
const { createTestUser, createTestHospital, createTestAppointment, createTestPayment, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Payments Routes', () => {
  let patient, doctor, staff, hospital, patientToken, staffToken;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    staff = await createTestUser('hospital_staff');
    hospital = await createTestHospital();
    
    patientToken = generateToken(patient._id, patient.role);
    staffToken = generateToken(staff._id, staff.role);
  });

  describe('POST /api/payments - Process Payment', () => {
    let appointment;

    beforeEach(async () => {
      appointment = await createTestAppointment(patient, doctor, hospital);
    });

    it('should process payment successfully', async () => {
      const paymentData = {
        patientID: patient._id,
        appointmentID: appointment._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
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

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment).toBeDefined();
      expect(response.body.data.payment.paymentID).toBeDefined();
      expect(response.body.data.payment.amount).toBe(2000);
      expect(response.body.data.payment.status).toBe('completed');
    });

    it('should process payment with credit card', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 3000,
        method: 'credit_card',
        billingDetails: {
          services: [{
            serviceName: 'Lab Test',
            unitPrice: 3000,
            quantity: 1,
            totalPrice: 3000,
          }],
        },
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.method).toBe('credit_card');
    });

    it('should process payment with insurance', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 5000,
        method: 'insurance',
        insuranceInfo: {
          provider: 'Test Insurance',
          policyNumber: 'POL123456',
          claimNumber: 'CLM789012',
          coveredAmount: 4000,
          patientResponsibility: 1000,
        },
        billingDetails: {
          services: [{
            serviceName: 'Surgery',
            unitPrice: 5000,
            quantity: 1,
            totalPrice: 5000,
          }],
        },
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.insuranceInfo).toBeDefined();
      expect(response.body.data.payment.insuranceInfo.provider).toBe('Test Insurance');
    });

    it('should fail without required fields', async () => {
      const incompleteData = {
        amount: 2000,
        method: 'cash',
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid payment method', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'invalid_method',
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with negative amount', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: -1000,
        method: 'cash',
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
      };

      const response = await request(app)
        .post('/api/payments')
        .send(paymentData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments - Get Payments', () => {
    beforeEach(async () => {
      // Create multiple payments
      await createTestPayment(patient, hospital, { status: 'completed' });
      await createTestPayment(patient, hospital, { status: 'pending' });
      await createTestPayment(patient, hospital, { status: 'failed' });
    });

    it('should get all payments for patient', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payments).toBeInstanceOf(Array);
      expect(response.body.data.payments.length).toBeGreaterThan(0);
    });

    it('should filter payments by status', async () => {
      const response = await request(app)
        .get('/api/payments?status=completed')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const payments = response.body.data.payments;
      expect(payments.every(p => p.status === 'completed')).toBe(true);
    });

    it('should filter payments by method', async () => {
      await createTestPayment(patient, hospital, { method: 'credit_card' });

      const response = await request(app)
        .get('/api/payments?method=credit_card')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const payments = response.body.data.payments;
      expect(payments.some(p => p.method === 'credit_card')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/payments?page=1&limit=2')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payments.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should get payments for staff (all hospital payments)', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payments).toBeInstanceOf(Array);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/payments')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/:id - Get Payment By ID', () => {
    let payment;

    beforeEach(async () => {
      payment = await createTestPayment(patient, hospital);
    });

    it('should get payment by ID', async () => {
      const response = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment._id).toBe(payment._id.toString());
      expect(response.body.data.payment.amount).toBe(payment.amount);
    });

    it('should populate related data', async () => {
      const response = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      const paymentData = response.body.data.payment;
      expect(paymentData.patientID).toBeDefined();
      expect(paymentData.hospitalID).toBeDefined();
    });

    it('should fail with invalid payment ID', async () => {
      const response = await request(app)
        .get('/api/payments/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${patientToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/payments/:id - Update Payment', () => {
    let payment;

    beforeEach(async () => {
      payment = await createTestPayment(patient, hospital, { status: 'pending' });
    });

    it('should update payment status as staff', async () => {
      const response = await request(app)
        .put(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${staffToken}`])
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.status).toBe('completed');
    });

    it('should track who processed the payment', async () => {
      const response = await request(app)
        .put(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${staffToken}`])
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.processedBy).toBeDefined();
    });

    it('should fail with invalid status', async () => {
      const response = await request(app)
        .put(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${staffToken}`])
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .put(`/api/payments/${payment._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send({ status: 'completed' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/:id/receipt - Generate Receipt', () => {
    let payment;

    beforeEach(async () => {
      payment = await createTestPayment(patient, hospital, { status: 'completed' });
    });

    it('should generate receipt for completed payment', async () => {
      const response = await request(app)
        .post(`/api/payments/${payment._id}/receipt`)
        .set('Cookie', [`token=${patientToken}`])
        .send({ format: 'pdf' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.receipt).toBeDefined();
      expect(response.body.data.receipt.receiptNumber).toBeDefined();
    });

    it('should fail for pending payments', async () => {
      const pendingPayment = await createTestPayment(patient, hospital, { status: 'pending' });

      const response = await request(app)
        .post(`/api/payments/${pendingPayment._id}/receipt`)
        .set('Cookie', [`token=${patientToken}`])
        .send({ format: 'pdf' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('completed');
    });
  });

  describe('POST /api/payments/:id/refund - Process Refund', () => {
    let payment;

    beforeEach(async () => {
      payment = await createTestPayment(patient, hospital, { status: 'completed' });
    });

    it('should process refund as staff', async () => {
      const refundData = {
        refundAmount: 500,
        refundReason: 'Appointment cancelled',
        refundMethod: 'cash',
      };

      const response = await request(app)
        .post(`/api/payments/${payment._id}/refund`)
        .set('Cookie', [`token=${staffToken}`])
        .send(refundData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.refund).toBeDefined();
      expect(response.body.data.payment.refund.refundAmount).toBe(500);
    });

    it('should fail with refund amount greater than payment', async () => {
      const refundData = {
        refundAmount: 10000,
        refundReason: 'Test',
        refundMethod: 'cash',
      };

      const response = await request(app)
        .post(`/api/payments/${payment._id}/refund`)
        .set('Cookie', [`token=${staffToken}`])
        .send(refundData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail without reason', async () => {
      const refundData = {
        refundAmount: 500,
        refundMethod: 'cash',
      };

      const response = await request(app)
        .post(`/api/payments/${payment._id}/refund`)
        .set('Cookie', [`token=${staffToken}`])
        .send(refundData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large payment amounts', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 999999.99,
        method: 'bank_transfer',
        billingDetails: {
          services: [{
            serviceName: 'Large Payment Service',
            unitPrice: 999999.99,
            quantity: 1,
            totalPrice: 999999.99,
          }],
          subtotal: 999999.99,
          tax: 0,
          discount: 0,
          total: 999999.99,
        },
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.amount).toBe(999999.99);
    });

    it('should handle payments with many services', async () => {
      const services = Array(20).fill(null).map((_, i) => ({
        serviceName: `Service ${i + 1}`,
        unitPrice: 100,
        quantity: 1,
        totalPrice: 100,
      }));

      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        billingDetails: {
          services,
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000,
        },
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Cookie', [`token=${staffToken}`])
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.billingDetails.services).toHaveLength(20);
    });

    it('should handle concurrent payment processing', async () => {
      const paymentData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        method: 'cash',
        billingDetails: {
          services: [{
            serviceName: 'Concurrent Payment Service',
            unitPrice: 1000,
            quantity: 1,
            totalPrice: 1000,
          }],
          subtotal: 1000,
          tax: 0,
          discount: 0,
          total: 1000,
        },
      };

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/payments')
          .set('Cookie', [`token=${staffToken}`])
          .send({ 
            ...paymentData, 
            amount: (i + 1) * 1000,
            billingDetails: {
              ...paymentData.billingDetails,
              services: [{
                ...paymentData.billingDetails.services[0],
                unitPrice: (i + 1) * 1000,
                totalPrice: (i + 1) * 1000,
              }],
              subtotal: (i + 1) * 1000,
              total: (i + 1) * 1000,
            }
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // All should have unique payment IDs
      const paymentIDs = responses.map(r => r.body.data.payment.paymentID);
      const uniqueIDs = new Set(paymentIDs);
      expect(uniqueIDs.size).toBe(5);
    });
  });
});

