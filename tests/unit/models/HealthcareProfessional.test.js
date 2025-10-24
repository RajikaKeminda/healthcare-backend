const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const HealthcareProfessional = require('../../../models/HealthcareProfessional');
const User = require('../../../models/User');

describe('HealthcareProfessional Model', () => {
  let mongoServer;

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
    await User.deleteMany({});
  });

  const baseUserData = {
    dateOfBirth: new Date('1980-01-15'),
    address: {
      street: '123 Medical St',
      city: 'Medical City',
      state: 'Medical State',
      zipCode: '12345',
      country: 'Sri Lanka'
    }
  };

  describe('HealthcareProfessional Creation', () => {
    it('should create a valid healthcare professional with required fields', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        yearsOfExperience: 10,
        consultationFee: 150
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional._id).toBeDefined();
      expect(savedProfessional.professionalID).toBeDefined();
      expect(savedProfessional.userName).toBe(professionalData.userName);
      expect(savedProfessional.email).toBe(professionalData.email);
      expect(savedProfessional.specialization).toBe(professionalData.specialization);
      expect(savedProfessional.licenseNumber).toBe(professionalData.licenseNumber);
      expect(savedProfessional.department).toBe(professionalData.department);
      expect(savedProfessional.yearsOfExperience).toBe(professionalData.yearsOfExperience);
      expect(savedProfessional.consultationFee).toBe(professionalData.consultationFee);
      expect(savedProfessional.isAvailable).toBe(true);
    });

    it('should fail without required fields', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData
        // Missing specialization, licenseNumber, department, consultationFee
      };

      const professional = new HealthcareProfessional(professionalData);
      
      await expect(professional.save()).rejects.toThrow();
    });

    it('should generate unique professionalID', async () => {
      const professionalData1 = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150
      };

      const professionalData2 = {
        userName: 'Dr. Jane Doe',
        email: 'jane.doe@hospital.com',
        password: 'password123',
        phone: '+1234567891',
        role: 'healthcare_professional',
        dateOfBirth: new Date('1985-03-20'),
        address: {
          street: '456 Neurology Ave',
          city: 'Neurology City',
          state: 'Neurology State',
          zipCode: '54321',
          country: 'Sri Lanka'
        },
        specialization: 'Neurology',
        licenseNumber: 'LIC123457',
        department: 'Neurology',
        consultationFee: 200
      };

      const professional1 = new HealthcareProfessional(professionalData1);
      const professional2 = new HealthcareProfessional(professionalData2);
      
      const saved1 = await professional1.save();
      const saved2 = await professional2.save();

      expect(saved1.professionalID).toBeDefined();
      expect(saved2.professionalID).toBeDefined();
      expect(saved1.professionalID).not.toBe(saved2.professionalID);
    });

    it('should validate specialization enum', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'InvalidSpecialization',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150
      };

      const professional = new HealthcareProfessional(professionalData);
      
      await expect(professional.save()).rejects.toThrow();
    });

    it('should validate licenseNumber uniqueness', async () => {
      const professionalData1 = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150
      };

      const professionalData2 = {
        userName: 'Dr. Jane Doe',
        email: 'jane.doe@hospital.com',
        password: 'password123',
        phone: '+1234567891',
        role: 'healthcare_professional',
        dateOfBirth: new Date('1985-03-20'),
        address: {
          street: '456 Neurology Ave',
          city: 'Neurology City',
          state: 'Neurology State',
          zipCode: '54321',
          country: 'Sri Lanka'
        },
        specialization: 'Neurology',
        licenseNumber: 'LIC123456', // Same license number
        department: 'Neurology',
        consultationFee: 200
      };

      const professional1 = new HealthcareProfessional(professionalData1);
      await professional1.save();

      const professional2 = new HealthcareProfessional(professionalData2);
      
      await expect(professional2.save()).rejects.toThrow();
    });

    it('should validate yearsOfExperience range', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        yearsOfExperience: 60, // Invalid: exceeds max of 50
        consultationFee: 150
      };

      const professional = new HealthcareProfessional(professionalData);
      
      await expect(professional.save()).rejects.toThrow();
    });

    it('should validate consultationFee minimum', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: -50 // Invalid: negative fee
      };

      const professional = new HealthcareProfessional(professionalData);
      
      await expect(professional.save()).rejects.toThrow();
    });
  });

  describe('HealthcareProfessional with Qualifications', () => {
    it('should store qualifications correctly', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        qualifications: [
          {
            degree: 'MD',
            institution: 'Harvard Medical School',
            year: 2010
          },
          {
            degree: 'PhD',
            institution: 'Johns Hopkins',
            year: 2015
          }
        ]
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.qualifications).toHaveLength(2);
      expect(savedProfessional.qualifications[0].degree).toBe('MD');
      expect(savedProfessional.qualifications[0].institution).toBe('Harvard Medical School');
      expect(savedProfessional.qualifications[0].year).toBe(2010);
    });

    it('should validate qualification required fields', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        qualifications: [
          {
            degree: 'MD',
            // Missing institution and year
          }
        ]
      };

      const professional = new HealthcareProfessional(professionalData);
      
      await expect(professional.save()).rejects.toThrow();
    });
  });

  describe('HealthcareProfessional Working Hours', () => {
    it('should set default working hours', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.workingHours.monday.available).toBe(true);
      expect(savedProfessional.workingHours.tuesday.available).toBe(true);
      expect(savedProfessional.workingHours.saturday.available).toBe(false);
      expect(savedProfessional.workingHours.sunday.available).toBe(false);
    });

    it('should store custom working hours', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        workingHours: {
          monday: { start: '09:00', end: '17:00', available: true },
          tuesday: { start: '09:00', end: '17:00', available: true },
          wednesday: { start: '09:00', end: '17:00', available: true },
          thursday: { start: '09:00', end: '17:00', available: true },
          friday: { start: '09:00', end: '17:00', available: true },
          saturday: { start: '10:00', end: '14:00', available: true },
          sunday: { start: '10:00', end: '14:00', available: false }
        }
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.workingHours.monday.start).toBe('09:00');
      expect(savedProfessional.workingHours.monday.end).toBe('17:00');
      expect(savedProfessional.workingHours.saturday.available).toBe(true);
    });
  });

  describe('HealthcareProfessional Additional Fields', () => {
    it('should store bio and languages', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        bio: 'Experienced cardiologist with 10 years of practice',
        languages: ['English', 'Spanish', 'French']
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.bio).toBe(professionalData.bio);
      expect(savedProfessional.languages).toEqual(['English', 'Spanish', 'French']);
    });

    it('should link to hospital', async () => {
      const hospitalId = new mongoose.Types.ObjectId();
      
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        hospitalID: hospitalId
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.hospitalID.toString()).toBe(hospitalId.toString());
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long bio', async () => {
      const longBio = 'a'.repeat(1000);
      
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        bio: longBio
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.bio).toBe(longBio);
    });

    it('should handle many qualifications', async () => {
      const qualifications = Array.from({ length: 10 }, (_, i) => ({
        degree: `Degree${i}`,
        institution: `Institution${i}`,
        year: 2000 + i
      }));
      
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        consultationFee: 150,
        qualifications
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.qualifications).toHaveLength(10);
    });

    it('should handle boundary yearsOfExperience values', async () => {
      const professionalData = {
        userName: 'Dr. John Smith',
        email: 'john.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'healthcare_professional',
        ...baseUserData,
        specialization: 'Cardiology',
        licenseNumber: 'LIC123456',
        department: 'Cardiology',
        yearsOfExperience: 50, // Maximum allowed
        consultationFee: 150
      };

      const professional = new HealthcareProfessional(professionalData);
      const savedProfessional = await professional.save();

      expect(savedProfessional.yearsOfExperience).toBe(50);
    });
  });
});