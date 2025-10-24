const request = require('supertest');
const app = require('../../../app');
const { createTestUser, createTestHospital, createTestAppointment, createTestMedicalRecord, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Medical Records Routes', () => {
  let patient, doctor, staff, hospital, patientToken, doctorToken, staffToken;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    staff = await createTestUser('hospital_staff');
    hospital = await createTestHospital();
    
    patientToken = generateToken(patient._id, patient.role);
    doctorToken = generateToken(doctor._id, doctor.role);
    staffToken = generateToken(staff._id, staff.role);
  });

  describe('POST /api/medical-records - Create Medical Record', () => {
    let appointment;

    beforeEach(async () => {
      appointment = await createTestAppointment(patient, doctor, hospital);
    });

    it('should create medical record as doctor', async () => {
      const recordData = {
        patientID: patient._id,
        appointmentID: appointment._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Headache and fever',
        historyOfPresentIllness: 'Symptoms started 2 days ago',
        diagnosis: [{
          description: 'Viral infection',
          code: 'ICD10-B34.9',
        }],
        treatmentPlan: {
          medications: [{
            name: 'Paracetamol',
            dosage: '500mg',
            frequency: 'Three times daily',
            duration: '5 days',
          }],
        },
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord).toBeDefined();
      expect(response.body.data.medicalRecord.recordID).toBeDefined();
      expect(response.body.data.medicalRecord.chiefComplaint).toBe('Headache and fever');
    });

    it('should create record with vital signs', async () => {
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Routine checkup',
        physicalExamination: {
          vitalSigns: {
            bloodPressure: '120/80',
            heartRate: 75,
            temperature: 98.6,
            respiratoryRate: 16,
          },
        },
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.physicalExamination.vitalSigns.bloodPressure).toBe('120/80');
    });

    it('should fail without required fields', async () => {
      const incompleteData = {
        patientID: patient._id,
        // Missing chiefComplaint and other required fields
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for non-doctor roles', async () => {
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Test',
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${patientToken}`])
        .send(recordData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Test',
      };

      const response = await request(app)
        .post('/api/medical-records')
        .send(recordData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/medical-records - Get Medical Records', () => {
    beforeEach(async () => {
      // Create multiple records
      await createTestMedicalRecord(patient, doctor, hospital);
      await createTestMedicalRecord(patient, doctor, hospital, {
        chiefComplaint: 'Follow-up visit',
      });
      await createTestMedicalRecord(patient, doctor, hospital, {
        chiefComplaint: 'Annual checkup',
      });
    });

    it('should get all medical records for patient', async () => {
      const response = await request(app)
        .get('/api/medical-records')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecords).toBeInstanceOf(Array);
      expect(response.body.data.medicalRecords.length).toBeGreaterThan(0);
    });

    it('should get medical records for doctor (their patients)', async () => {
      const response = await request(app)
        .get('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecords).toBeInstanceOf(Array);
    });

    it('should filter records by patient', async () => {
      const anotherPatient = await createTestUser('patient');
      await createTestMedicalRecord(anotherPatient, doctor, hospital);

      const response = await request(app)
        .get(`/api/medical-records?patientID=${patient._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      expect(records.every(r => r.patientID._id.toString() === patient._id.toString())).toBe(true);
    });

    it('should filter records by doctor', async () => {
      const response = await request(app)
        .get(`/api/medical-records?doctorID=${doctor._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      expect(records.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/medical-records?page=1&limit=2')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecords.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should sort records by date', async () => {
      const response = await request(app)
        .get('/api/medical-records?sortBy=visitDate&sortOrder=desc')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      // Check if sorted by date (newest first)
      for (let i = 0; i < records.length - 1; i++) {
        const date1 = new Date(records[i].visitDate);
        const date2 = new Date(records[i + 1].visitDate);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });
  });

  describe('GET /api/medical-records/:id - Get Medical Record By ID', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should get medical record by ID as patient', async () => {
      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord._id).toBe(record._id.toString());
      expect(response.body.data.medicalRecord.chiefComplaint).toBeDefined();
    });

    it('should get medical record by ID as doctor', async () => {
      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord._id).toBe(record._id.toString());
    });

    it('should populate related data', async () => {
      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      const recordData = response.body.data.medicalRecord;
      expect(recordData.patientID).toBeDefined();
      expect(recordData.doctorID).toBeDefined();
      expect(recordData.hospitalID).toBeDefined();
    });

    it('should fail with invalid record ID', async () => {
      const response = await request(app)
        .get('/api/medical-records/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${patientToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized patient', async () => {
      const anotherPatient = await createTestUser('patient');
      const anotherToken = generateToken(anotherPatient._id, anotherPatient.role);

      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${anotherToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/medical-records/:id - Update Medical Record', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should update medical record as doctor', async () => {
      const updates = {
        diagnosis: [
          { description: 'Updated diagnosis', code: 'ICD10-NEW' },
        ],
        treatmentPlan: {
          medications: [
            {
              name: 'New Medicine',
              dosage: '250mg',
              frequency: 'Twice daily',
              duration: '7 days',
            },
          ],
          followUpInstructions: 'Return in 1 week',
        },
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.diagnosis[0].description).toBe('Updated diagnosis');
      expect(response.body.data.medicalRecord.treatmentPlan.medications[0].name).toBe('New Medicine');
    });

    it('should add progress notes', async () => {
      const updates = {
        progressNotes: [
          {
            date: new Date(),
            note: 'Patient showing improvement',
          },
        ],
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.progressNotes).toHaveLength(1);
    });

    it('should fail for unauthorized roles', async () => {
      const updates = {
        chiefComplaint: 'Updated complaint',
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid record ID', async () => {
      const updates = { chiefComplaint: 'Updated' };

      const response = await request(app)
        .put('/api/medical-records/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/medical-records/:id - Delete Medical Record', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should delete medical record as doctor', async () => {
      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid record ID', async () => {
      const response = await request(app)
        .delete('/api/medical-records/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${doctorToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/medical-records - Additional Test Cases for Lines 1-93', () => {
    beforeEach(async () => {
      // Create multiple records for testing
      await createTestMedicalRecord(patient, doctor, hospital, {
        visitDate: new Date('2023-01-01'),
        chiefComplaint: 'January visit'
      });
      await createTestMedicalRecord(patient, doctor, hospital, {
        visitDate: new Date('2023-02-01'),
        chiefComplaint: 'February visit'
      });
      await createTestMedicalRecord(patient, doctor, hospital, {
        visitDate: new Date('2023-03-01'),
        chiefComplaint: 'March visit'
      });
    });

    it('should validate query parameters - invalid page', async () => {
      const response = await request(app)
        .get('/api/medical-records?page=0')
        .set('Cookie', [`token=${patientToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should validate query parameters - invalid limit', async () => {
      const response = await request(app)
        .get('/api/medical-records?limit=200')
        .set('Cookie', [`token=${patientToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate query parameters - invalid patientID', async () => {
      const response = await request(app)
        .get('/api/medical-records?patientID=invalid-id')
        .set('Cookie', [`token=${doctorToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate query parameters - invalid doctorID', async () => {
      const response = await request(app)
        .get('/api/medical-records?doctorID=invalid-id')
        .set('Cookie', [`token=${doctorToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate query parameters - invalid dateFrom', async () => {
      const response = await request(app)
        .get('/api/medical-records?dateFrom=invalid-date')
        .set('Cookie', [`token=${patientToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate query parameters - invalid dateTo', async () => {
      const response = await request(app)
        .get('/api/medical-records?dateTo=invalid-date')
        .set('Cookie', [`token=${patientToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should filter records by date range', async () => {
      const response = await request(app)
        .get('/api/medical-records?dateFrom=2023-01-01&dateTo=2023-02-28')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      expect(records.length).toBeGreaterThan(0);
      
      // Check all records are within date range
      records.forEach(record => {
        const visitDate = new Date(record.visitDate);
        expect(visitDate.getTime()).toBeGreaterThanOrEqual(new Date('2023-01-01').getTime());
        expect(visitDate.getTime()).toBeLessThanOrEqual(new Date('2023-02-28').getTime());
      });
    });

    it('should filter records by dateFrom only', async () => {
      const response = await request(app)
        .get('/api/medical-records?dateFrom=2023-02-01')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      expect(records.length).toBeGreaterThan(0);
      
      records.forEach(record => {
        const visitDate = new Date(record.visitDate);
        expect(visitDate.getTime()).toBeGreaterThanOrEqual(new Date('2023-02-01').getTime());
      });
    });

    it('should filter records by dateTo only', async () => {
      const response = await request(app)
        .get('/api/medical-records?dateTo=2023-02-28')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      expect(records.length).toBeGreaterThan(0);
      
      records.forEach(record => {
        const visitDate = new Date(record.visitDate);
        expect(visitDate.getTime()).toBeLessThanOrEqual(new Date('2023-02-28').getTime());
      });
    });

    it('should handle pagination with custom limit', async () => {
      const response = await request(app)
        .get('/api/medical-records?page=1&limit=2')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecords.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(2);
    });

    it('should handle second page pagination', async () => {
      const response = await request(app)
        .get('/api/medical-records?page=2&limit=1')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.currentPage).toBe(2);
    });

    it('should populate all related data correctly', async () => {
      const response = await request(app)
        .get('/api/medical-records')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      
      if (records.length > 0) {
        const record = records[0];
        expect(record.patientID).toBeDefined();
        expect(record.patientID.userName).toBeDefined();
        expect(record.patientID.email).toBeDefined();
        expect(record.patientID.phone).toBeDefined();
        
        expect(record.doctorID).toBeDefined();
        expect(record.doctorID.userName).toBeDefined();
        expect(record.doctorID.email).toBeDefined();
        expect(record.doctorID.specialization).toBeDefined();
        
        expect(record.hospitalID).toBeDefined();
        expect(record.hospitalID.name).toBeDefined();
        expect(record.hospitalID.address).toBeDefined();
      }
    });

    it('should sort records by visitDate descending', async () => {
      const response = await request(app)
        .get('/api/medical-records')
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const records = response.body.data.medicalRecords;
      
      // Check if sorted by date (newest first)
      for (let i = 0; i < records.length - 1; i++) {
        const date1 = new Date(records[i].visitDate);
        const date2 = new Date(records[i + 1].visitDate);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });

    it('should handle server error gracefully', async () => {
      // Mock MedicalRecord.find to throw an error
      const originalFind = require('../../../models/MedicalRecord').find;
      require('../../../models/MedicalRecord').find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/medical-records')
        .set('Cookie', [`token=${patientToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching medical records');
      
      // Restore original function
      require('../../../models/MedicalRecord').find = originalFind;
    });
  });

  describe('POST /api/medical-records - Additional Test Cases for Lines 178-179', () => {
    it('should handle server error during creation', async () => {
      // Mock MedicalRecord constructor to throw an error
      const originalCreate = require('../../../models/MedicalRecord');
      const mockCreate = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });
      jest.spyOn(require('../../../models/MedicalRecord'), 'create').mockImplementation(mockCreate);

      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Test complaint',
        diagnosis: [{ description: 'Test diagnosis' }]
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while creating medical record');
      
      // Restore original function
      jest.restoreAllMocks();
    });
  });

  describe('PUT /api/medical-records/:id - Additional Test Cases for Lines 195, 215-222, 231', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should handle validation errors in PUT route', async () => {
      const invalidUpdates = {
        chiefComplaint: '', // Empty string should fail validation
        diagnosis: 'not-an-array' // Should be array
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(invalidUpdates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should deny access to patient trying to update another patient\'s record', async () => {
      const anotherPatient = await createTestUser('patient');
      const anotherPatientToken = generateToken(anotherPatient._id, anotherPatient.role);

      const updates = {
        chiefComplaint: 'Updated complaint'
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${anotherPatientToken}`])
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should deny access to doctor trying to update another doctor\'s record', async () => {
      const anotherDoctor = await createTestUser('healthcare_professional');
      const anotherDoctorToken = generateToken(anotherDoctor._id, anotherDoctor.role);

      const updates = {
        chiefComplaint: 'Updated complaint'
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${anotherDoctorToken}`])
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should handle date updates correctly', async () => {
      const newDate = '2023-12-25T10:00:00.000Z';
      const updates = {
        visitDate: newDate,
        chiefComplaint: 'Updated complaint'
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.visitDate).toBe(newDate);
    });

    it('should update other fields correctly', async () => {
      const updates = {
        chiefComplaint: 'Updated chief complaint',
        diagnosis: [{ description: 'Updated diagnosis', code: 'ICD10-UPDATED' }],
        treatmentPlan: {
          medications: [{
            name: 'Updated Medicine',
            dosage: '250mg',
            frequency: 'Once daily',
            duration: '10 days'
          }]
        }
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.chiefComplaint).toBe('Updated chief complaint');
      expect(response.body.data.medicalRecord.diagnosis[0].description).toBe('Updated diagnosis');
      expect(response.body.data.medicalRecord.treatmentPlan.medications[0].name).toBe('Updated Medicine');
    });

    it('should log access when updating record', async () => {
      const updates = {
        chiefComplaint: 'Updated complaint'
      };

      const response = await request(app)
        .put(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify access log was updated
      const updatedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      const lastAccess = updatedRecord.accessLog[updatedRecord.accessLog.length - 1];
      expect(lastAccess.action).toBe('edited');
      expect(lastAccess.accessedBy.toString()).toBe(doctor._id.toString());
    });
  });

  describe('GET /api/medical-records/:id - Additional Test Cases for Lines 293, 312-313', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should deny access to doctor trying to view another doctor\'s record', async () => {
      const anotherDoctor = await createTestUser('healthcare_professional');
      const anotherDoctorToken = generateToken(anotherDoctor._id, anotherDoctor.role);

      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${anotherDoctorToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should handle server error when fetching record by ID', async () => {
      // Mock MedicalRecord.findById to throw an error
      const originalFindById = require('../../../models/MedicalRecord').findById;
      require('../../../models/MedicalRecord').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching medical record');
      
      // Restore original function
      require('../../../models/MedicalRecord').findById = originalFindById;
    });

    it('should log access when viewing record', async () => {
      const response = await request(app)
        .get(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify access log was updated
      const updatedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      const lastAccess = updatedRecord.accessLog[updatedRecord.accessLog.length - 1];
      expect(lastAccess.action).toBe('viewed');
      expect(lastAccess.accessedBy.toString()).toBe(patient._id.toString());
    });
  });

  describe('POST /api/medical-records/:id/attachments - Test Cases for Lines 323-384', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should handle no file uploaded', async () => {
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No file uploaded');
    });

    it('should deny access to patient trying to upload to another patient\'s record', async () => {
      const anotherPatient = await createTestUser('patient');
      const anotherPatientToken = generateToken(anotherPatient._id, anotherPatient.role);

      // Create a mock file
      const mockFile = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${anotherPatientToken}`])
        .attach('file', mockFile, 'test.txt')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should deny access to doctor trying to upload to another doctor\'s record', async () => {
      const anotherDoctor = await createTestUser('healthcare_professional');
      const anotherDoctorToken = generateToken(anotherDoctor._id, anotherDoctor.role);

      // Create a mock file
      const mockFile = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${anotherDoctorToken}`])
        .attach('file', mockFile, 'test.txt')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should handle server error during file upload', async () => {
      // Mock MedicalRecord.findById to throw an error
      const originalFindById = require('../../../models/MedicalRecord').findById;
      require('../../../models/MedicalRecord').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      // Create a mock file
      const mockFile = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${doctorToken}`])
        .attach('file', mockFile, 'test.txt')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while uploading file');
      
      // Restore original function
      require('../../../models/MedicalRecord').findById = originalFindById;
    });

    it('should successfully upload file attachment', async () => {
      // Create a mock file
      const mockFile = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${doctorToken}`])
        .attach('file', mockFile, 'test.txt')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.data.attachment).toBeDefined();
      expect(response.body.data.attachment.fileName).toBe('test.txt');
      expect(response.body.data.attachment.uploadedBy).toBe(doctor._id.toString());
    });

    it('should log access when uploading file', async () => {
      // Create a mock file
      const mockFile = Buffer.from('test file content');
      
      const response = await request(app)
        .post(`/api/medical-records/${record._id}/attachments`)
        .set('Cookie', [`token=${doctorToken}`])
        .attach('file', mockFile, 'test.txt')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify access log was updated
      const updatedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      const lastAccess = updatedRecord.accessLog[updatedRecord.accessLog.length - 1];
      expect(lastAccess.action).toBe('edited');
      expect(lastAccess.accessedBy.toString()).toBe(doctor._id.toString());
    });
  });

  describe('POST /api/medical-records/:id/progress-notes - Test Cases for Lines 396-457', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should handle validation errors for progress notes', async () => {
      const invalidNote = {
        note: '' // Empty note should fail validation
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(invalidNote)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should deny access to patient trying to add progress note to another patient\'s record', async () => {
      const anotherPatient = await createTestUser('patient');
      const anotherPatientToken = generateToken(anotherPatient._id, anotherPatient.role);

      const progressNote = {
        note: 'Test progress note'
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${anotherPatientToken}`])
        .send(progressNote)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should deny access to doctor trying to add progress note to another doctor\'s record', async () => {
      const anotherDoctor = await createTestUser('healthcare_professional');
      const anotherDoctorToken = generateToken(anotherDoctor._id, anotherDoctor.role);

      const progressNote = {
        note: 'Test progress note'
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${anotherDoctorToken}`])
        .send(progressNote)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should handle server error when adding progress note', async () => {
      // Mock MedicalRecord.findById to throw an error
      const originalFindById = require('../../../models/MedicalRecord').findById;
      require('../../../models/MedicalRecord').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const progressNote = {
        note: 'Test progress note'
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(progressNote)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while adding progress note');
      
      // Restore original function
      require('../../../models/MedicalRecord').findById = originalFindById;
    });

    it('should successfully add progress note', async () => {
      const progressNote = {
        note: 'Patient showing significant improvement'
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(progressNote)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Progress note added successfully');
      expect(response.body.data.progressNote).toBeDefined();
      expect(response.body.data.progressNote.note).toBe('Patient showing significant improvement');
      expect(response.body.data.progressNote.author).toBe(doctor._id.toString());
    });

    it('should log access when adding progress note', async () => {
      const progressNote = {
        note: 'Test progress note'
      };

      const response = await request(app)
        .post(`/api/medical-records/${record._id}/progress-notes`)
        .set('Cookie', [`token=${doctorToken}`])
        .send(progressNote)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify access log was updated
      const updatedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      const lastAccess = updatedRecord.accessLog[updatedRecord.accessLog.length - 1];
      expect(lastAccess.action).toBe('edited');
      expect(lastAccess.accessedBy.toString()).toBe(doctor._id.toString());
    });
  });

  describe('DELETE /api/medical-records/:id - Additional Test Cases for Lines 480, 497', () => {
    let record;

    beforeEach(async () => {
      record = await createTestMedicalRecord(patient, doctor, hospital);
    });

    it('should deny access to doctor trying to delete another doctor\'s record', async () => {
      const anotherDoctor = await createTestUser('healthcare_professional');
      const anotherDoctorToken = generateToken(anotherDoctor._id, anotherDoctor.role);

      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${anotherDoctorToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });

    it('should handle server error when deleting record', async () => {
      // Mock MedicalRecord.findById to throw an error
      const originalFindById = require('../../../models/MedicalRecord').findById;
      require('../../../models/MedicalRecord').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while deleting medical record');
      
      // Restore original function
      require('../../../models/MedicalRecord').findById = originalFindById;
    });

    it('should log access when deleting record', async () => {
      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify access log was updated
      const updatedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      const lastAccess = updatedRecord.accessLog[updatedRecord.accessLog.length - 1];
      expect(lastAccess.action).toBe('deleted');
      expect(lastAccess.accessedBy.toString()).toBe(doctor._id.toString());
    });

    it('should perform soft delete (set isActive to false)', async () => {
      const response = await request(app)
        .delete(`/api/medical-records/${record._id}`)
        .set('Cookie', [`token=${doctorToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify record is soft deleted
      const deletedRecord = await require('../../../models/MedicalRecord').findById(record._id);
      expect(deletedRecord.isActive).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle records with extensive medical history', async () => {
      const medications = Array(30).fill(null).map((_, i) => ({
        name: `Medicine ${i + 1}`,
        dosage: '100mg',
        frequency: 'Once daily',
        duration: '30 days',
      }));

      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Complex medical history',
        treatmentPlan: {
          medications,
        },
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.treatmentPlan.medications).toHaveLength(30);
    });

    it('should handle very long chief complaints', async () => {
      const longComplaint = 'Patient reports '.repeat(100);
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: longComplaint,
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.chiefComplaint).toBe(longComplaint);
    });

    it('should handle records from past dates', async () => {
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: '2020-01-01',
        chiefComplaint: 'Historical record',
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle concurrent record creations', async () => {
      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
      };

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/medical-records')
          .set('Cookie', [`token=${doctorToken}`])
          .send({ ...recordData, chiefComplaint: `Complaint ${i + 1}` })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // All should have unique record IDs
      const recordIDs = responses.map(r => r.body.data.medicalRecord.recordID);
      const uniqueIDs = new Set(recordIDs);
      expect(uniqueIDs.size).toBe(5);
    });

    it('should handle multiple diagnoses', async () => {
      const diagnoses = Array(10).fill(null).map((_, i) => ({
        description: `Diagnosis ${i + 1}`,
        code: `ICD10-${i}`,
      }));

      const recordData = {
        patientID: patient._id,
        hospitalID: hospital._id,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'Multiple conditions',
        diagnosis: diagnoses,
      };

      const response = await request(app)
        .post('/api/medical-records')
        .set('Cookie', [`token=${doctorToken}`])
        .send(recordData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.medicalRecord.diagnosis).toHaveLength(10);
    });
  });
});

