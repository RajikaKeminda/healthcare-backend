const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Patient = require('../../../models/Patient');
const User = require('../../../models/User');

describe('Patient Model', () => {
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
    dateOfBirth: new Date('1990-06-15'),
    address: {
      street: '789 Patient St',
      city: 'Patient City',
      state: 'Patient State',
      zipCode: '98765',
      country: 'Sri Lanka'
    }
  };

  describe('Patient Creation', () => {
    it('should create a valid patient with required fields', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        }
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient._id).toBeDefined();
      expect(savedPatient.patientID).toBeDefined();
      expect(savedPatient.userName).toBe(patientData.userName);
      expect(savedPatient.email).toBe(patientData.email);
      expect(savedPatient.bloodType).toBe(patientData.bloodType);
      expect(savedPatient.emergencyContact.name).toBe(patientData.emergencyContact.name);
      expect(savedPatient.emergencyContact.relationship).toBe(patientData.emergencyContact.relationship);
      expect(savedPatient.emergencyContact.phone).toBe(patientData.emergencyContact.phone);
      expect(savedPatient.preferredLanguage).toBe('English');
    });

    it('should fail without required fields', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData
        // Missing bloodType and emergencyContact
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    it('should generate unique patientID', async () => {
      const patientData1 = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        }
      };

      const patientData2 = {
        userName: 'Jane Smith',
        email: 'jane.smith@email.com',
        password: 'password123',
        phone: '+1234567892',
        role: 'patient',
        dateOfBirth: new Date('1992-08-20'),
        address: {
          street: '321 Smith St',
          city: 'Smith City',
          state: 'Smith State',
          zipCode: '11111',
          country: 'Sri Lanka'
        },
        bloodType: 'B+',
        emergencyContact: {
          name: 'John Smith',
          relationship: 'Spouse',
          phone: '+1234567893'
        }
      };

      const patient1 = new Patient(patientData1);
      const patient2 = new Patient(patientData2);
      
      const saved1 = await patient1.save();
      const saved2 = await patient2.save();

      expect(saved1.patientID).toBeDefined();
      expect(saved2.patientID).toBeDefined();
      expect(saved1.patientID).not.toBe(saved2.patientID);
    });

    it('should validate bloodType enum', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'InvalidType',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        }
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate emergencyContact required fields', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          // Missing relationship and phone
        }
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate height and weight ranges', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        height: 350, // Invalid: exceeds max of 300
        weight: 1200 // Invalid: exceeds max of 1000
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });
  });

  describe('Patient Medical History', () => {
    it('should store medical history correctly', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        medicalHistory: [
          {
            condition: 'Diabetes',
            diagnosisDate: new Date('2020-01-15'),
            status: 'chronic',
            notes: 'Type 2 diabetes, well controlled'
          },
          {
            condition: 'Hypertension',
            diagnosisDate: new Date('2019-06-10'),
            status: 'active',
            notes: 'High blood pressure, on medication'
          }
        ]
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.medicalHistory).toHaveLength(2);
      expect(savedPatient.medicalHistory[0].condition).toBe('Diabetes');
      expect(savedPatient.medicalHistory[0].status).toBe('chronic');
      expect(savedPatient.medicalHistory[1].condition).toBe('Hypertension');
      expect(savedPatient.medicalHistory[1].status).toBe('active');
    });

    it('should validate medical history required fields', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        medicalHistory: [
          {
            condition: 'Diabetes',
            // Missing diagnosisDate
            status: 'chronic'
          }
        ]
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate medical history status enum', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        medicalHistory: [
          {
            condition: 'Diabetes',
            diagnosisDate: new Date('2020-01-15'),
            status: 'invalid_status'
          }
        ]
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });
  });

  describe('Patient Allergies', () => {
    it('should store allergies correctly', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        allergies: [
          {
            allergen: 'Penicillin',
            severity: 'severe',
            reaction: 'Anaphylaxis'
          },
          {
            allergen: 'Shellfish',
            severity: 'moderate',
            reaction: 'Hives and swelling'
          }
        ]
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.allergies).toHaveLength(2);
      expect(savedPatient.allergies[0].allergen).toBe('Penicillin');
      expect(savedPatient.allergies[0].severity).toBe('severe');
      expect(savedPatient.allergies[1].allergen).toBe('Shellfish');
      expect(savedPatient.allergies[1].severity).toBe('moderate');
    });

    it('should validate allergy required fields', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        allergies: [
          {
            allergen: 'Penicillin',
            // Missing severity
            reaction: 'Anaphylaxis'
          }
        ]
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    it('should validate allergy severity enum', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        allergies: [
          {
            allergen: 'Penicillin',
            severity: 'invalid_severity',
            reaction: 'Anaphylaxis'
          }
        ]
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });
  });

  describe('Patient Insurance Information', () => {
    it('should store insurance information correctly', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        insuranceInfo: {
          provider: 'Blue Cross Blue Shield',
          policyNumber: 'BC123456789',
          groupNumber: 'GRP001',
          expiryDate: new Date('2024-12-31')
        }
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.insuranceInfo.provider).toBe('Blue Cross Blue Shield');
      expect(savedPatient.insuranceInfo.policyNumber).toBe('BC123456789');
      expect(savedPatient.insuranceInfo.groupNumber).toBe('GRP001');
      expect(savedPatient.insuranceInfo.expiryDate).toEqual(new Date('2024-12-31'));
    });

    it('should handle partial insurance information', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        insuranceInfo: {
          provider: 'Medicare',
          policyNumber: 'MED123456'
          // Missing groupNumber and expiryDate
        }
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.insuranceInfo.provider).toBe('Medicare');
      expect(savedPatient.insuranceInfo.policyNumber).toBe('MED123456');
      expect(savedPatient.insuranceInfo.groupNumber).toBeUndefined();
      expect(savedPatient.insuranceInfo.expiryDate).toBeUndefined();
    });
  });

  describe('Patient Physical Measurements', () => {
    it('should store height and weight correctly', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        height: 175, // cm
        weight: 70 // kg
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.height).toBe(175);
      expect(savedPatient.weight).toBe(70);
    });

    it('should handle boundary height and weight values', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        height: 300, // Maximum allowed
        weight: 1000 // Maximum allowed
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.height).toBe(300);
      expect(savedPatient.weight).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extensive medical history', async () => {
      const medicalHistory = Array.from({ length: 20 }, (_, i) => ({
        condition: `Condition ${i}`,
        diagnosisDate: new Date(2020 + i, 0, 1),
        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'chronic' : 'resolved',
        notes: `Notes for condition ${i}`
      }));
      
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        medicalHistory
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.medicalHistory).toHaveLength(20);
    });

    it('should handle many allergies', async () => {
      const allergies = Array.from({ length: 15 }, (_, i) => ({
        allergen: `Allergen ${i}`,
        severity: i % 3 === 0 ? 'mild' : i % 3 === 1 ? 'moderate' : 'severe',
        reaction: `Reaction ${i}`
      }));
      
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        allergies
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.allergies).toHaveLength(15);
    });

    it('should handle all blood types', async () => {
      const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      
      for (let i = 0; i < bloodTypes.length; i++) {
        const patientData = {
          userName: `Patient ${i}`,
          email: `patient${i}@email.com`,
          password: 'password123',
          phone: '+1234567890',
          role: 'patient',
          dateOfBirth: new Date('1990-06-15'),
          address: {
            street: '789 Patient St',
            city: 'Patient City',
            state: 'Patient State',
            zipCode: '98765',
            country: 'Sri Lanka'
          },
          bloodType: bloodTypes[i],
          emergencyContact: {
            name: `Emergency ${i}`,
            relationship: 'Spouse',
            phone: '+1234567891'
          }
        };

        const patient = new Patient(patientData);
        const savedPatient = await patient.save();

        expect(savedPatient.bloodType).toBe(bloodTypes[i]);
      }
    });

    it('should handle custom preferred language', async () => {
      const patientData = {
        userName: 'John Doe',
        email: 'john.doe@email.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'patient',
        ...baseUserData,
        bloodType: 'A+',
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567891'
        },
        preferredLanguage: 'Spanish'
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient.preferredLanguage).toBe('Spanish');
    });
  });
});