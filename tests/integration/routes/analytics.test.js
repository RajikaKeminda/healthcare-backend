const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../../app');
const User = require('../../../models/User');
const Appointment = require('../../../models/Appointment');
const Payment = require('../../../models/Payment');
const MedicalRecord = require('../../../models/MedicalRecord');
const Hospital = require('../../../models/Hospital');
const { createTestUser, createTestToken } = require('../../utils/testHelpers');

describe('Analytics Routes', () => {
  let mongoServer;
  let managerToken;
  let staffToken;
  let patientToken;
  let manager;
  let staff;
  let patient;
  let hospital;
  let doctor;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Appointment.deleteMany({});
    await Payment.deleteMany({});
    await MedicalRecord.deleteMany({});
    await Hospital.deleteMany({});

    // Create test users
    manager = await createTestUser({
      userName: 'Manager',
      email: 'manager@test.com',
      password: 'password123',
      phone: '+1234567890',
      role: 'healthcare_manager'
    });

    staff = await createTestUser({
      userName: 'Staff',
      email: 'staff@test.com',
      password: 'password123',
      phone: '+1234567891',
      role: 'hospital_staff',
      staffRole: 'nurse',
      department: 'Emergency',
      employeeID: 'EMP001',
      hireDate: new Date('2020-01-15'),
      workingHours: { start: '08:00', end: '16:00' }
    });

    patient = await createTestUser({
      userName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      phone: '+1234567892',
      role: 'patient',
      bloodType: 'A+',
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567893'
      }
    });

    doctor = await createTestUser({
      userName: 'Doctor',
      email: 'doctor@test.com',
      password: 'password123',
      phone: '+1234567894',
      role: 'healthcare_professional',
      specialization: 'Cardiology',
      licenseNumber: 'LIC123456',
      department: 'Cardiology',
      consultationFee: 150
    });

    // Create test hospital
    hospital = await Hospital.create({
      name: 'Test Hospital',
      type: 'general',
      address: {
        street: '123 Main St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      contactInfo: {
        phone: '+1234567890',
        email: 'hospital@test.com'
      },
      capacity: {
        totalBeds: 100,
        occupiedBeds: 50
      },
      departments: ['Emergency', 'Cardiology'],
      facilities: ['ICU', 'Lab'],
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '17:00' },
        sunday: { open: '09:00', close: '17:00' }
      },
      isActive: true
    });

    // Create test appointments
    await Appointment.create([
      {
        appointmentID: 'APT001',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date(),
        time: '10:00',
        type: 'consultation',
        status: 'completed',
        symptoms: 'Chest pain',
        notes: 'Patient complaint'
      },
      {
        appointmentID: 'APT002',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date(),
        time: '11:00',
        type: 'follow_up',
        status: 'cancelled',
        symptoms: 'Follow up',
        notes: 'Cancelled by patient'
      },
      {
        appointmentID: 'APT003',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date(),
        time: '12:00',
        type: 'consultation',
        status: 'no_show',
        symptoms: 'No show',
        notes: 'Patient did not show up'
      }
    ]);

    // Create test payments
    await Payment.create([
      {
        paymentID: 'PAY001',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 2000,
        method: 'cash',
        status: 'completed',
        billingDetails: {
          services: ['Consultation'],
          subtotal: 2000,
          tax: 0,
          discount: 0,
          total: 2000
        }
      },
      {
        paymentID: 'PAY002',
        patientID: patient._id,
        hospitalID: hospital._id,
        amount: 1500,
        method: 'card',
        status: 'pending',
        billingDetails: {
          services: ['Follow up'],
          subtotal: 1500,
          tax: 0,
          discount: 0,
          total: 1500
        }
      }
    ]);

    // Create test medical records
    await MedicalRecord.create([
      {
        recordID: 'REC001',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        chiefComplaint: 'Chest pain',
        vitalSigns: {
          bloodPressure: '120/80',
          heartRate: 72,
          temperature: 98.6,
          respiratoryRate: 16
        },
        diagnosis: [
          {
            condition: 'Angina',
            icdCode: 'I20.9',
            notes: 'Stable angina'
          }
        ],
        treatment: {
          medications: [
            {
              name: 'Aspirin',
              dosage: '81mg',
              frequency: 'Daily'
            }
          ],
          instructions: 'Take medication as prescribed'
        }
      }
    ]);

    // Create tokens
    managerToken = createTestToken(manager);
    staffToken = createTestToken(staff);
    patientToken = createTestToken(patient);
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should get dashboard analytics for manager', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.dateRange).toBeDefined();

      // Check overview data
      expect(response.body.data.overview.totalPatients).toBe(1);
      expect(response.body.data.overview.totalAppointments).toBe(3);
      expect(response.body.data.overview.completedAppointments).toBe(1);
      expect(response.body.data.overview.cancelledAppointments).toBe(1);
      expect(response.body.data.overview.noShowAppointments).toBe(1);
      expect(response.body.data.overview.totalRevenue).toBe(2000);
      expect(response.body.data.overview.totalPayments).toBe(1);
      expect(response.body.data.overview.pendingPayments).toBe(1);
      expect(response.body.data.overview.totalDoctors).toBe(1);
      expect(response.body.data.overview.activeDoctors).toBe(1);
      expect(response.body.data.overview.totalBeds).toBe(100);
      expect(response.body.data.overview.occupiedBeds).toBe(50);

      // Check metrics
      expect(response.body.data.metrics.appointmentCompletionRate).toBeDefined();
      expect(response.body.data.metrics.noShowRate).toBeDefined();
      expect(response.body.data.metrics.bedOccupancyRate).toBeDefined();
      expect(response.body.data.metrics.averageRevenuePerAppointment).toBeDefined();
    });

    it('should get dashboard analytics for staff', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Cookie', [`token=${staffToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
    });

    it('should filter by hospitalID', async () => {
      const response = await request(app)
        .get(`/api/analytics/dashboard?hospitalID=${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalBeds).toBe(100);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/analytics/dashboard?dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange.startDate).toBeDefined();
      expect(response.body.data.dateRange.endDate).toBeDefined();
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      // Mock Hospital.find to throw an error
      const originalFind = Hospital.find;
      Hospital.find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Server error');

      // Restore original method
      Hospital.find = originalFind;
    });
  });

  describe('GET /api/analytics/appointments', () => {
    it('should get appointment analytics for manager', async () => {
      const response = await request(app)
        .get('/api/analytics/appointments')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.statusDistribution).toBeDefined();
      expect(response.body.data.typeDistribution).toBeDefined();
    });

    it('should filter appointments by hospitalID', async () => {
      const response = await request(app)
        .get(`/api/analytics/appointments?hospitalID=${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter appointments by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/analytics/appointments?dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group appointments by day', async () => {
      const response = await request(app)
        .get('/api/analytics/appointments?groupBy=day')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group appointments by week', async () => {
      const response = await request(app)
        .get('/api/analytics/appointments?groupBy=week')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group appointments by month', async () => {
      const response = await request(app)
        .get('/api/analytics/appointments?groupBy=month')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/analytics/appointments')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFind = Appointment.find;
      Appointment.find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/appointments')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      Appointment.find = originalFind;
    });
  });

  describe('GET /api/analytics/financial', () => {
    it('should get financial analytics for manager', async () => {
      const response = await request(app)
        .get('/api/analytics/financial')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.revenueTrends).toBeDefined();
      expect(response.body.data.paymentMethodDistribution).toBeDefined();
      expect(response.body.data.metrics).toBeDefined();
    });

    it('should filter financial data by hospitalID', async () => {
      const response = await request(app)
        .get(`/api/analytics/financial?hospitalID=${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter financial data by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/analytics/financial?dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group financial data by day', async () => {
      const response = await request(app)
        .get('/api/analytics/financial?groupBy=day')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group financial data by week', async () => {
      const response = await request(app)
        .get('/api/analytics/financial?groupBy=week')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group financial data by month', async () => {
      const response = await request(app)
        .get('/api/analytics/financial?groupBy=month')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/analytics/financial')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalAggregate = Payment.aggregate;
      Payment.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/financial')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      Payment.aggregate = originalAggregate;
    });
  });

  describe('GET /api/analytics/patients', () => {
    it('should get patient analytics for manager', async () => {
      const response = await request(app)
        .get('/api/analytics/patients')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.registrationTrends).toBeDefined();
      expect(response.body.data.ageDistribution).toBeDefined();
      expect(response.body.data.activityMetrics).toBeDefined();
    });

    it('should filter patient data by hospitalID', async () => {
      const response = await request(app)
        .get(`/api/analytics/patients?hospitalID=${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter patient data by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/analytics/patients?dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group patient data by day', async () => {
      const response = await request(app)
        .get('/api/analytics/patients?groupBy=day')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group patient data by week', async () => {
      const response = await request(app)
        .get('/api/analytics/patients?groupBy=week')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should group patient data by month', async () => {
      const response = await request(app)
        .get('/api/analytics/patients?groupBy=month')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/analytics/patients')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalCountDocuments = User.countDocuments;
      User.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/patients')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      User.countDocuments = originalCountDocuments;
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export appointment data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?type=appointments')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should export payment data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?type=payments')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should export patient data', async () => {
      const response = await request(app)
        .get('/api/analytics/export?type=patients')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter export data by hospitalID', async () => {
      const response = await request(app)
        .get(`/api/analytics/export?type=appointments&hospitalID=${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter export data by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/analytics/export?type=appointments&dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail for invalid export type', async () => {
      const response = await request(app)
        .get('/api/analytics/export?type=invalid')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/analytics/export?type=appointments')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFind = Appointment.find;
      Appointment.find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/export?type=appointments')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      Appointment.find = originalFind;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      // Clear all data
      await User.deleteMany({});
      await Appointment.deleteMany({});
      await Payment.deleteMany({});
      await MedicalRecord.deleteMany({});
      await Hospital.deleteMany({});

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalPatients).toBe(0);
      expect(response.body.data.overview.totalAppointments).toBe(0);
    });

    it('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard?dateFrom=invalid-date&dateTo=invalid-date')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle very large date ranges', async () => {
      const startDate = new Date('2020-01-01').toISOString();
      const endDate = new Date('2030-12-31').toISOString();

      const response = await request(app)
        .get(`/api/analytics/dashboard?dateFrom=${startDate}&dateTo=${endDate}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle invalid hospitalID format', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard?hospitalID=invalid-id')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});