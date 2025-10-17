const request = require('supertest');
const app = require('../../../app');
const { createTestUser, createTestHospital, createTestAppointment, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Appointments Routes', () => {
  let patient, doctor, hospital, patientToken, doctorToken;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    
    patientToken = generateToken(patient._id, patient.role);
    doctorToken = generateToken(doctor._id, doctor.role);
  });

  describe('POST /api/appointments - Create Appointment', () => {
    it('should create appointment successfully as patient', async () => {
      const appointmentData = {
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: '2025-12-01',
        time: '10:00',
        type: 'consultation',
        symptoms: 'Test symptoms',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .send(appointmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toBeDefined();
      expect(response.body.data.appointment.appointmentID).toBeDefined();
      expect(response.body.data.appointment.patientID.toString()).toBe(patient._id.toString());
      expect(response.body.data.appointment.status).toBe('scheduled');
    });

    it('should fail without authentication', async () => {
      const appointmentData = {
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: '2025-12-01',
        time: '10:00',
        type: 'consultation',
      };

      const response = await request(app)
        .post('/api/appointments')
        .send(appointmentData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const incompleteData = {
        doctorID: doctor._id,
        // Missing hospitalID, date, time, type
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid doctor ID', async () => {
      const appointmentData = {
        doctorID: '507f1f77bcf86cd799439011', // Non-existent
        hospitalID: hospital._id,
        date: '2025-12-01',
        time: '10:00',
        type: 'consultation',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .send(appointmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate appointment type', async () => {
      const appointmentData = {
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: '2025-12-01',
        time: '10:00',
        type: 'invalid_type',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .send(appointmentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/appointments - Get Appointments', () => {
    beforeEach(async () => {
      // Create multiple appointments
      await createTestAppointment(patient, doctor, hospital);
      await createTestAppointment(patient, doctor, hospital, { status: 'completed' });
      await createTestAppointment(patient, doctor, hospital, { status: 'cancelled' });
    });

    it('should get all appointments for patient', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointments).toBeInstanceOf(Array);
      expect(response.body.data.appointments.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter appointments by status', async () => {
      const response = await request(app)
        .get('/api/appointments?status=completed')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const appointments = response.body.data.appointments;
      expect(appointments.every(apt => apt.status === 'completed')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/appointments?page=1&limit=2')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointments.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should get appointments for doctor', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointments).toBeInstanceOf(Array);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/appointments/:id - Get Single Appointment', () => {
    let appointment;

    beforeEach(async () => {
      appointment = await createTestAppointment(patient, doctor, hospital);
    });

    it('should get appointment by ID', async () => {
      const response = await request(app)
        .get(`/api/appointments/${appointment._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toBeDefined();
      expect(response.body.data.appointment._id).toBe(appointment._id.toString());
    });

    it('should fail with invalid appointment ID', async () => {
      const response = await request(app)
        .get('/api/appointments/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${patientToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should populate related data', async () => {
      const response = await request(app)
        .get(`/api/appointments/${appointment._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      const apt = response.body.data.appointment;
      expect(apt.doctorID).toBeDefined();
      expect(apt.hospitalID).toBeDefined();
      expect(apt.patientID).toBeDefined();
    });
  });

  describe('PUT /api/appointments/:id - Update Appointment', () => {
    let appointment;

    beforeEach(async () => {
      appointment = await createTestAppointment(patient, doctor, hospital);
    });

    it('should update appointment status as doctor', async () => {
      const response = await request(app)
        .put(`/api/appointments/${appointment._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment.status).toBe('completed');
    });

    it('should update appointment notes', async () => {
      const response = await request(app)
        .put(`/api/appointments/${appointment._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment.notes).toBe('Updated notes');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .put(`/api/appointments/${appointment._id}`)
        .send({ status: 'completed' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .put(`/api/appointments/${appointment._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/appointments/:id/cancel - Cancel Appointment', () => {
    let appointment;

    beforeEach(async () => {
      appointment = await createTestAppointment(patient, doctor, hospital);
    });

    it('should cancel appointment as patient', async () => {
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/cancel`)
        .set('Cookie', [`token=${patientToken}`])
        .send({ cancellationReason: 'Patient request' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment.status).toBe('cancelled');
      expect(response.body.data.appointment.cancellationReason).toBe('Patient request');
    });

    it('should require cancellation reason', async () => {
      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/cancel`)
        .set('Cookie', [`token=${patientToken}`])
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should not cancel already completed appointment', async () => {
      appointment.status = 'completed';
      await appointment.save();

      const response = await request(app)
        .post(`/api/appointments/${appointment._id}/cancel`)
        .set('Cookie', [`token=${patientToken}`])
        .send({ cancellationReason: 'Patient request' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent appointment creations', async () => {
      const appointmentData = {
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: '2025-12-01',
        time: '10:00',
        type: 'consultation',
        symptoms: 'Test symptoms',
      };

      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/appointments')
          .set('Cookie', [`token=${patientToken}`])
          .send(appointmentData)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed with unique IDs
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      const appointmentIDs = responses.map(r => r.body.data.appointment.appointmentID);
      const uniqueIDs = new Set(appointmentIDs);
      expect(uniqueIDs.size).toBe(5);
    });

    it('should handle past dates gracefully', async () => {
      const appointmentData = {
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: '2020-01-01',
        time: '10:00',
        type: 'consultation',
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .send(appointmentData);

      // System should either accept or reject with clear message
      expect([201, 400]).toContain(response.status);
      expect(response.body.success).toBeDefined();
    });

    it('should handle invalid time formats', async () => {
      const invalidTimes = ['25:00', '10:60', 'invalid', ''];

      for (const time of invalidTimes) {
        const response = await request(app)
          .post('/api/appointments')
          .set('Cookie', [`token=${patientToken}`])
          .send({
            doctorID: doctor._id,
            hospitalID: hospital._id,
            date: '2025-12-01',
            time,
            type: 'consultation',
          });

        expect([400, 500]).toContain(response.status);
      }
    });
  });
});

