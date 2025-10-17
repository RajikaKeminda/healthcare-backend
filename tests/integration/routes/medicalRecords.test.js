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

