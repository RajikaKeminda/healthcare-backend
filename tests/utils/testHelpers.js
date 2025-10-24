const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Patient = require('../../models/Patient');
const HealthcareProfessional = require('../../models/HealthcareProfessional');
const HospitalStaff = require('../../models/HospitalStaff');
const Hospital = require('../../models/Hospital');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');
const MedicalRecord = require('../../models/MedicalRecord');

// Generate JWT token for testing
const generateToken = (userId, role = 'patient') => {
  return jwt.sign(
    { userId, role },
    'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Create test user fixtures
const createTestUser = async (role = 'patient', overrides = {}) => {
  const baseData = {
    patientID: `PAT${Date.now()}`,
    userName: `test_${role}_${Date.now()}`,
    email: `test_${role}_${Date.now()}@test.com`,
    password: 'Test123!@#',
    phone: '+94771234567',
    dateOfBirth: new Date('1990-01-01'),
    role,
    address: {
      street: '123 Test St',
      city: 'Colombo',
      state: 'Western',
      zipCode: '10000',
      country: 'Sri Lanka',
    },
    workingHours: {
      Monday: {
        open: '09:00',
        close: '17:00',
      },
      Tuesday: {
        open: '09:00',
        close: '17:00',
      },
      Wednesday: {
        open: '09:00',
        close: '17:00',
      },
      Thursday: {
        open: '09:00',
        close: '17:00',
      },
      Friday: {
        open: '09:00',
        close: '17:00',
      },
      Saturday: {
        open: '09:00',
        close: '17:00',
      },
      Sunday: {
        open: '09:00',
        close: '17:00',
      },
    },
    ...overrides,
  };

  let user;
  switch (role) {
    case 'patient':
      user = await Patient.create({
        ...baseData,
        patientID: `PAT${Date.now()}`,
        bloodType: 'O+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '+94771234568',
          email: 'emergency@test.com',
        },
      });
      break;
    case 'healthcare_professional':
      user = await HealthcareProfessional.create({
        ...baseData,
        professionalID: `DOC${Date.now()}`,
        specialization: 'General Medicine',
        licenseNumber: 'LIC123456',
        department: 'Internal Medicine',
        yearsOfExperience: 5,
        consultationFee: 2000,
      });
      break;
    case 'hospital_staff':
      user = await HospitalStaff.create({
        ...baseData,
        staffID: `STAFF${Date.now()}`,
        staffRole: 'receptionist',
        employeeID: 'EMP123456',
        hireDate: new Date('2020-01-01'),
        workingHours: {
          start: '09:00',
          end: '17:00',
        },
        department: 'Reception',
      });
      break;
    case 'healthcare_manager':
      user = await User.create(baseData);
      break;
    default:
      user = await User.create(baseData);
  }

  return user;
};

// Create test hospital
const createTestHospital = async (overrides = {}) => {
  return await Hospital.create({
    hospitalID: `HOS${Date.now()}`,
    name: `Test Hospital ${Date.now()}`,
    type: 'private',
    address: {
      street: '456 Hospital Ave',
      city: 'Colombo',
      state: 'Western',
      zipCode: '10100',
      country: 'Sri Lanka',
    },
    contactInfo: {
      phone: '+94112345678',
      email: 'hospital@test.com',
      website: 'https://testhospital.com',
    },
    departments: ['Cardiology', 'Neurology', 'Pediatrics'],
    capacity: {
      totalBeds: 100,
      occupiedBeds: 50,
      icuBeds: 10,
      emergencyBeds: 15,
    },
    facilities: ['emergency', 'icu', 'laboratory'],
    ...overrides,
  });
};

// Create test appointment
const createTestAppointment = async (patient, doctor, hospital, overrides = {}) => {
  return await Appointment.create({
    appointmentID: `APT${Date.now()}`,
    patientID: patient._id,
    doctorID: doctor._id,
    hospitalID: hospital._id,
    date: new Date(Date.now() + 86400000), // Tomorrow
    time: '10:00',
    type: 'consultation',
    status: 'scheduled',
    symptoms: 'Test symptoms',
    reservationFee: {
      amount: 1000,
      paid: false,
      paymentDate: null,
      paymentMethod: null,
    },
    consultationFee: {
      amount: 2000,
      paid: false,
      paymentDate: null,
      paymentMethod: null,
    },
    ...overrides,
  });
};

// Create test payment
const createTestPayment = async (patient, hospital, overrides = {}) => {
  return await Payment.create({
    paymentID: `PAY${Date.now()}`,
    patientID: patient._id,
    hospitalID: hospital._id,
    amount: 2000,
    method: 'cash',
    status: 'completed',
    transactionReference: `TXN${Date.now()}`,
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
    ...overrides,
  });
};

// Create test medical record
const createTestMedicalRecord = async (patient, doctor, hospital, overrides = {}) => {
  return await MedicalRecord.create({
    recordID: `MR${Date.now()}`,
    patientID: patient._id,
    doctorID: doctor._id,
    hospitalID: hospital._id,
    visitDate: new Date(),
    chiefComplaint: 'Test complaint',
    diagnosis: [{
      description: 'Test diagnosis',
      code: 'ICD10-TEST',
    }],
    treatmentPlan: {
      medications: [{
        name: 'Test Medicine',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '7 days',
      }],
    },
    ...overrides,
  });
};

module.exports = {
  generateToken,
  createTestUser,
  createTestHospital,
  createTestAppointment,
  createTestPayment,
  createTestMedicalRecord,
};

