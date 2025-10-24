const MedicalRecord = require('../../../models/MedicalRecord');
const { createTestUser, createTestHospital, createTestAppointment } = require('../../utils/testHelpers');

require('../../setup');

describe('MedicalRecord Model', () => {
  let patient, doctor, hospital, appointment;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    appointment = await createTestAppointment(patient, doctor, hospital);
  });

  describe('Medical Record Creation', () => {
    it('should create a valid medical record with required fields', async () => {
      const recordData = {
        recordID: 'MR001',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Headache and fever',
        diagnosis: [{
          description: 'Common cold',
          code: 'ICD10-J00',
        }],
      };

      const record = await MedicalRecord.create(recordData);

      expect(record).toBeDefined();
      expect(record.recordID).toBe('MR001');
      expect(record.chiefComplaint).toBe('Headache and fever');
      expect(record.diagnosis).toHaveLength(1);
    });

    it('should fail without required fields', async () => {
      const recordData = {
        recordID: 'MR002',
        // Missing required fields
      };

      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });

    it('should generate unique recordID', async () => {
      const recordData = {
        recordID: 'MR003',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
      };

      await MedicalRecord.create(recordData);

      // Try to create duplicate
      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });
  });

  describe('History and Examination', () => {
    it('should store history of present illness', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR004',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Chest pain',
        historyOfPresentIllness: 'Patient reports chest pain for 2 days, worsening with exertion',
      });

      expect(record.historyOfPresentIllness).toContain('chest pain');
    });

    it('should store vital signs', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR005',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Routine checkup',
        physicalExamination: {
          vitalSigns: {
            bloodPressure: '120/80',
            heartRate: 75,
            temperature: 98.6,
            respiratoryRate: 16,
            oxygenSaturation: 98,
          },
        },
      });

      expect(record.physicalExamination.vitalSigns.bloodPressure).toBe('120/80');
      expect(record.physicalExamination.vitalSigns.heartRate).toBe(75);
      expect(record.physicalExamination.vitalSigns.temperature).toBe(98.6);
    });

    it('should store general examination findings', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR006',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'General weakness',
        physicalExamination: {
          generalAppearance: 'Patient appears pale and fatigued',
        },
      });

      expect(record.physicalExamination.generalAppearance).toContain('pale');
    });

    it('should store system-specific examination', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR007',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Abdominal pain',
        physicalExamination: {
          cardiovascular: 'Normal heart sounds, no murmurs',
          respiratory: 'Clear bilateral breath sounds',
          gastrointestinal: 'Tenderness in right lower quadrant',
        },
      });

      expect(record.physicalExamination.gastrointestinal).toContain('Tenderness');
    });
  });

  describe('Diagnosis', () => {
    it('should store multiple diagnoses', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR008',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Multiple symptoms',
        diagnosis: [
          { description: 'Hypertension', code: 'ICD10-I10' },
          { description: 'Type 2 Diabetes', code: 'ICD10-E11' },
          { description: 'Hyperlipidemia', code: 'ICD10-E78.5' },
        ],
      });

      expect(record.diagnosis).toHaveLength(3);
      expect(record.diagnosis[0].description).toBe('Hypertension');
      expect(record.diagnosis[1].code).toBe('ICD10-E11');
    });

    it('should handle diagnosis without code', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR009',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
        diagnosis: [
          { description: 'Suspected viral infection' },
        ],
      });

      expect(record.diagnosis[0].description).toBe('Suspected viral infection');
      expect(record.diagnosis[0].code).toBeUndefined();
    });
  });

  describe('Treatment Plan', () => {
    it('should store medications', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR010',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Infection',
        treatmentPlan: {
          medications: [
            {
              name: 'Amoxicillin',
              dosage: '500mg',
              frequency: 'Three times daily',
              duration: '7 days',
              instructions: 'Take with food',
            },
            {
              name: 'Ibuprofen',
              dosage: '400mg',
              frequency: 'As needed for pain',
              duration: '5 days',
            },
          ],
        },
      });

      expect(record.treatmentPlan.medications).toHaveLength(2);
      expect(record.treatmentPlan.medications[0].name).toBe('Amoxicillin');
      expect(record.treatmentPlan.medications[0].dosage).toBe('500mg');
    });

    it('should store procedures', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR011',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Laceration',
        treatmentPlan: {
          procedures: [
            { name: 'Wound cleaning', description: 'Clean the wound area' },
            { name: 'Suturing', description: 'Close the wound with sutures' },
            { name: 'Dressing', description: 'Apply sterile dressing' }
          ],
        },
      });

      expect(record.treatmentPlan.procedures).toHaveLength(3);
      expect(record.treatmentPlan.procedures[1].name).toBe('Suturing');
    });

    it('should store follow-up instructions', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR012',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Post-surgery check',
        treatmentPlan: {
          followUpInstructions: 'Return in 2 weeks for suture removal. Call immediately if signs of infection.',
          followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        },
      });

      expect(record.treatmentPlan.followUpInstructions).toContain('2 weeks');
      // expect(record.treatmentPlan.followUpDate).toBeDefined();
    });
  });

  describe('Lab Results and Imaging', () => {
    it('should store lab results', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR013',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Routine checkup',
        labResults: [
          {
            testName: 'Complete Blood Count',
            date: new Date(),
            results: 'WBC: 7.5, RBC: 5.0, Hemoglobin: 14.5',
            normalRange: 'WBC: 4-11, RBC: 4.5-5.5, Hb: 13-17',
            status: 'normal',
            testDate: new Date(),
          },
        ],
      });

      expect(record.labResults).toHaveLength(1);
      expect(record.labResults[0].testName).toBe('Complete Blood Count');
      expect(record.labResults[0].status).toBe('normal');
    });

    it('should store imaging reports', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR014',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Chest pain',
        imagingReports: [
          {
            type: 'X-Ray',
            bodyPart: 'Chest',
            date: new Date(),
            findings: 'Clear lung fields, normal heart size',
            radiologistNotes: 'No acute cardiopulmonary abnormalities',
          },
        ],
      });

      expect(record.imagingReports).toHaveLength(1);
      expect(record.imagingReports[0].type).toBe('X-Ray');
      expect(record.imagingReports[0].findings).toContain('Clear lung');
    });
  });

  describe('Progress Notes', () => {
    it('should store progress notes', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR015',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Follow-up',
        progressNotes: [
          {
            author: doctor._id,
            date: new Date(),
            note: 'Patient showing improvement. Continue current treatment.',
            addedBy: doctor._id,
          },
        ],
      });

      expect(record.progressNotes).toHaveLength(1);
      expect(record.progressNotes[0].note).toContain('improvement');
    });
  });

  describe('Attachments', () => {
    it('should store file attachments', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR016',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test',
        attachments: [
          {
            fileName: 'lab-report.pdf',
            fileType: 'application/pdf',
            fileUrl: '/uploads/records/lab-report.pdf',
            uploadedAt: new Date(),
            uploadedBy: doctor._id,
          },
        ],
      });

      expect(record.attachments).toHaveLength(1);
      expect(record.attachments[0].fileName).toBe('lab-report.pdf');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long chief complaints', async () => {
      const longComplaint = 'Test complaint ' + 'a'.repeat(1000);
      const record = await MedicalRecord.create({
        recordID: 'MR017',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: longComplaint,
      });

      expect(record.chiefComplaint).toBe(longComplaint);
    });

    it('should handle multiple medications', async () => {
      const medications = Array(20).fill(null).map((_, i) => ({
        name: `Medicine ${i + 1}`,
        dosage: '100mg',
        frequency: 'Once daily',
        duration: '30 days',
      }));

      const record = await MedicalRecord.create({
        recordID: 'MR018',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Multiple conditions',
        treatmentPlan: {
          medications,
        },
      });

      expect(record.treatmentPlan.medications).toHaveLength(20);
    });

    it('should handle past visit dates', async () => {
      const pastDate = new Date('2020-01-01');
      const record = await MedicalRecord.create({
        recordID: 'MR019',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: pastDate,
        chiefComplaint: 'Historical record',
      });

      expect(record.visitDate).toEqual(pastDate);
    });
  });

  describe('References', () => {
    it('should populate patient details', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR020',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test',
      });

      const populated = await MedicalRecord.findById(record._id)
        .populate('patientID', 'userName email bloodType');

      expect(populated.patientID.userName).toBe(patient.userName);
      // expect(populated.patientID.bloodType).toBeDefined();
    });

    it('should populate doctor details', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR021',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test',
      });

      const populated = await MedicalRecord.findById(record._id)
        .populate('doctorID', 'userName specialization licenseNumber');

      expect(populated.doctorID.userName).toBe(doctor.userName);
      // expect(populated.doctorID.specialization).toBeDefined();
    });

    it('should link to appointment', async () => {
      const record = await MedicalRecord.create({
        recordID: 'MR022',
        patientID: patient._id,
        doctorID: doctor._id,
        appointmentID: appointment._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test',
      });

      const populated = await MedicalRecord.findById(record._id)
        .populate('appointmentID', 'appointmentID date time');

      expect(populated.appointmentID.appointmentID).toBeDefined();
    });
  });

  describe('Error Cases', () => {
    it('should fail when creating medical record with invalid patient ID', async () => {
      const recordData = {
        recordID: 'MR_ERROR001',
        patientID: 'invalid-patient-id',
        doctorID: doctor._id,
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
      };

      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });

    it('should fail when creating medical record with invalid doctor ID', async () => {
      const recordData = {
        recordID: 'MR_ERROR002',
        patientID: patient._id,
        doctorID: 'invalid-doctor-id',
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
      };

      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });

    it('should fail when creating medical record with invalid hospital ID', async () => {
      const recordData = {
        recordID: 'MR_ERROR003',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: 'invalid-hospital-id',
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
      };

      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });

    it('should fail when creating medical record with invalid appointment ID', async () => {
      const recordData = {
        recordID: 'MR_ERROR004',
        patientID: patient._id,
        doctorID: doctor._id,
        appointmentID: 'invalid-appointment-id',
        hospitalID: hospital._id,
        visitDate: new Date(),
        chiefComplaint: 'Test complaint',
      };

      await expect(MedicalRecord.create(recordData)).rejects.toThrow();
    });
  });
});

