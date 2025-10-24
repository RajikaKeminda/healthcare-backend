const User = require('../../../models/User');
const Patient = require('../../../models/Patient');
const HealthcareProfessional = require('../../../models/HealthcareProfessional');
const bcrypt = require('bcryptjs');
const { createTestUser, createBasicUser } = require('../../utils/testHelpers');

require('../../setup');

describe('User Model', () => {
  describe('User Creation', () => {
    it('should create a valid user with required fields', async () => {
      const user = await createTestUser('patient');

      expect(user).toBeDefined();
      expect(user.userName).toContain('test_patient_');
      expect(user.email).toContain('test_patient_');
      expect(user.phone).toBe('+94771234567');
      expect(user.role).toBe('patient');
      expect(user.isActive).toBe(true);
    });

    it('should hash password before saving', async () => {
      const user = await createTestUser('patient');

      expect(user.password).not.toBe('Test123!@#');
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
      
      // Verify password can be compared
      const isMatch = await bcrypt.compare('Test123!@#', user.password);
      expect(isMatch).toBe(true);
    });

    it('should fail without required fields', async () => {
      const userData = {
        email: 'test@example.com',
        // Missing userName, password, phone, dateOfBirth
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        userName: 'testuser',
        email: 'invalid-email',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        userName: 'testuser1',
        email: 'duplicate@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      };

      await User.create(userData);

      // Try to create another user with same email
      const duplicateUser = {
        ...userData,
        userName: 'testuser2',
        phone: '+94771234568',
      };

      await expect(User.create(duplicateUser)).rejects.toThrow();
    });

    it('should set default role to patient', async () => {
      const user = await User.create({
        userName: 'defaultroleuser',
        email: 'defaultrole@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      });

      expect(user.role).toBe('patient');
    });

    it('should validate role enum', async () => {
      const userData = {
        userName: 'invalidrole',
        email: 'invalidrole@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'invalid_role',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('Patient Discriminator', () => {
    it('should create patient with medical fields', async () => {
      const patientData = {
        userName: 'patientuser',
        email: 'patient@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
        bloodType: 'O+',
        height: 170,
        weight: 70,
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '+94771234568',
        },
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      };

      const patient = await Patient.create(patientData);

      expect(patient).toBeDefined();
      expect(patient.bloodType).toBe('O+');
      expect(patient.height).toBe(170);
      expect(patient.weight).toBe(70);
      expect(patient.emergencyContact.name).toBe('Emergency Contact');
    });

    it('should validate blood type enum', async () => {
      const patientData = {
        userName: 'invalidblood',
        email: 'invalidblood@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
        bloodType: 'Invalid',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      };

      await expect(Patient.create(patientData)).rejects.toThrow();
    });
  });

  describe('HealthcareProfessional Discriminator', () => {
    it('should create healthcare professional with professional fields', async () => {
      const doctorData = {
        userName: 'doctoruser',
        email: 'doctor@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1980-01-01'),
        role: 'healthcare_professional',
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        yearsOfExperience: 10,
        consultationFee: 3000,
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      };

      const doctor = await HealthcareProfessional.create(doctorData);

      expect(doctor).toBeDefined();
      expect(doctor.specialization).toBe('Cardiology');
      expect(doctor.licenseNumber).toBe('LIC123456');
      expect(doctor.yearsOfExperience).toBe(10);
      expect(doctor.consultationFee).toBe(3000);
    });

    it('should require specialization for healthcare professional', async () => {
      const doctorData = {
        userName: 'doctornospec',
        email: 'doctornospec@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1980-01-01'),
        role: 'healthcare_professional',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
        // Missing specialization
      };

      await expect(HealthcareProfessional.create(doctorData)).rejects.toThrow();
    });
  });

  describe('Password Methods', () => {
    it('should not rehash password if not modified', async () => {
      const user = await User.create({
        userName: 'passwordtest',
        email: 'nohash@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      });

      const originalHash = user.password;
      user.userName = 'updatedname';
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long usernames', async () => {
      const longName = 'a'.repeat(100);
      const user = await User.create({
        userName: longName,
        email: 'longname@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: new Date('1990-01-01'),
        role: 'patient',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      });

      expect(user.userName).toBe(longName);
    });

    it('should handle edge case dates (very old)', async () => {
      const oldDate = new Date('1900-01-01');
      const user = await User.create({
        userName: 'olddate',
        email: 'olddate@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: oldDate,
        role: 'patient',
        address: { street: '123', city: 'Colombo', zipCode: '10000' },
      });

      expect(user.dateOfBirth).toEqual(oldDate);
    });

    it('should handle international phone formats', async () => {
      const phones = ['+1234567890', '+94771234567', '+447911123456'];
      
      for (const phone of phones) {
        const user = await User.create({
          userName: `user_${phone}`,
          email: `${phone}@test.com`,
          password: 'Test123!@#',
          phone,
          dateOfBirth: new Date('1990-01-01'),
          role: 'patient',
          address: { street: '123', city: 'Colombo', zipCode: '10000' },
        });

        expect(user.phone).toBe(phone);
      }
    });
  });
});

