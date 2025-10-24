const Appointment = require('../../../models/Appointment');
const { createTestUser, createTestHospital, createTestAppointment } = require('../../utils/testHelpers');

require('../../setup');

describe('Appointment Model', () => {
  let patient, doctor, hospital;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
  });

  describe('Appointment Creation', () => {
    it('should create a valid appointment with required fields', async () => {
      const appointment = await createTestAppointment(patient, doctor, hospital);

      expect(appointment).toBeDefined();
      expect(appointment.patientID.toString()).toBe(patient._id.toString());
      expect(appointment.doctorID.toString()).toBe(doctor._id.toString());
      expect(appointment.hospitalID.toString()).toBe(hospital._id.toString());
      expect(appointment.type).toBe('consultation');
      expect(appointment.status).toBe('scheduled');
      expect(appointment.reservationFee.amount).toBe(1000);
    });

    it('should fail without required fields', async () => {
      const appointmentData = {
        appointmentID: 'APT002',
        // Missing required fields
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });

    it('should generate unique appointmentID', async () => {
      const appointmentData = {
        appointmentID: 'APT003',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await Appointment.create(appointmentData);

      // Try to create duplicate
      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });

    it('should set default status to scheduled', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT004',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      expect(appointment.status).toBe('scheduled');
    });

    it('should validate appointment type enum', async () => {
      const appointmentData = {
        appointmentID: 'APT005',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'invalid_type',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const appointmentData = {
        appointmentID: 'APT006',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        status: 'invalid_status',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });
  });

  describe('Appointment Status Updates', () => {
    it('should update appointment status', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT007',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        status: 'scheduled',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      appointment.status = 'completed';
      await appointment.save();

      const updated = await Appointment.findById(appointment._id);
      expect(updated.status).toBe('completed');
    });

    it('should track cancellation reason', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT008',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        status: 'scheduled',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      appointment.status = 'cancelled';
      appointment.cancellation = {
        cancelledBy: 'patient',
        reason: 'Patient requested',
        cancelledAt: new Date()
      };
      await appointment.save();

      const updated = await Appointment.findById(appointment._id);
      expect(updated.status).toBe('cancelled');
      expect(updated.cancellation.reason).toBe('Patient requested');
    });
  });

  describe('Edge Cases', () => {
    it('should handle past dates', async () => {
      const pastDate = new Date('2020-01-01');
      const appointment = await Appointment.create({
        appointmentID: 'APT009',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: pastDate,
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      expect(appointment.date).toEqual(pastDate);
    });

    it('should handle different time formats', async () => {
      const times = ['09:00', '14:30', '23:59'];

      for (const time of times) {
        const appointment = await Appointment.create({
          appointmentID: `APT_${time.replace(':', '')}`,
          patientID: patient._id,
          doctorID: doctor._id,
          hospitalID: hospital._id,
          date: new Date('2025-12-01'),
          time,
          type: 'consultation',
          reservationFee: {
            amount: 1000,
            paid: false,
            paymentDate: null,
            paymentMethod: null,
          },
        });

        expect(appointment.time).toBe(time);
      }
    });

    it('should handle long symptoms and notes', async () => {
      const longText = 'a'.repeat(1000);
      const appointment = await Appointment.create({
        appointmentID: 'APT010',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        symptoms: [longText],
        notes: longText,
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      expect(appointment.symptoms).toEqual([longText]);
      expect(appointment.notes).toBe(longText);
    });
  });

  describe('References', () => {
    it('should populate patient details', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT011',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      const populated = await Appointment.findById(appointment._id)
        .populate('patientID', 'userName email');

      expect(populated.patientID.userName).toBe(patient.userName);
      expect(populated.patientID.email).toBe(patient.email);
    });

    it('should populate doctor details', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT012',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      const populated = await Appointment.findById(appointment._id)
        .populate('doctorID');

      expect(populated.doctorID.userName).toBe(doctor.userName);
      expect(populated.doctorID.specialization).toBe('General Medicine');
    });

    it('should populate hospital details', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT013',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        billingDetails: {
          services: [{
            serviceName: 'Consultation',
            unitPrice: 2000,
            quantity: 1,
            totalPrice: 2000,
          }],
        },
        subtotal: 2000,
        tax: 0,
        discount: 0,
        total: 2000,
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      const populated = await Appointment.findById(appointment._id)
        .populate('hospitalID', 'name address');

      expect(populated.hospitalID.name).toBe(hospital.name);
      expect(populated.hospitalID.address).toBeDefined();
    });
  });

  describe('Error Cases', () => {
    it('should fail when creating appointment with invalid patient ID', async () => {
      const appointmentData = {
        appointmentID: 'APT_ERROR001',
        patientID: 'invalid-patient-id',
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });

    it('should fail when creating appointment with invalid doctor ID', async () => {
      const appointmentData = {
        appointmentID: 'APT_ERROR002',
        patientID: patient._id,
        doctorID: 'invalid-doctor-id',
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });

    it('should fail when updating appointment with invalid status', async () => {
      const appointment = await Appointment.create({
        appointmentID: 'APT_ERROR003',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '10:00',
        type: 'consultation',
        status: 'scheduled',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      });

      appointment.status = 'invalid_status';
      await expect(appointment.save()).rejects.toThrow();
    });

    it('should fail when creating appointment with invalid time format', async () => {
      const appointmentData = {
        appointmentID: 'APT_ERROR004',
        patientID: patient._id,
        doctorID: doctor._id,
        hospitalID: hospital._id,
        date: new Date('2025-12-01'),
        time: '25:70', // Invalid time format
        type: 'consultation',
        reservationFee: {
          amount: 1000,
          paid: false,
          paymentDate: null,
          paymentMethod: null,
        },
      };

      await expect(Appointment.create(appointmentData)).rejects.toThrow();
    });
  });
});

