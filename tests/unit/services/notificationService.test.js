const notificationService = require('../../../services/notificationService');
const { createTestUser, createTestHospital, createTestAppointment, createTestPayment } = require('../../utils/testHelpers');

// Mock the email service
jest.mock('../../../services/emailService', () => ({
  sendAppointmentConfirmation: jest.fn(),
  sendAppointmentReminder: jest.fn(),
  sendPaymentConfirmation: jest.fn(),
  sendAppointmentCancellation: jest.fn()
}));

const emailService = require('../../../services/emailService');

require('../../setup');

describe('Notification Service', () => {
  let patient, doctor, hospital, appointment, payment;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    appointment = await createTestAppointment(patient, doctor, hospital);
    payment = await createTestPayment(patient, hospital, appointment);
    
    jest.clearAllMocks();
  });

  describe('sendAppointmentConfirmationNotification', () => {
    it('should send appointment confirmation notification successfully', async () => {
      const mockEmailResult = { success: true, messageId: 'test-message-id' };
      emailService.sendAppointmentConfirmation.mockResolvedValue(mockEmailResult);

      const result = await notificationService.sendAppointmentConfirmationNotification(appointment._id);

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);
      expect(result.message).toBe('Appointment confirmation notification sent successfully');
      expect(emailService.sendAppointmentConfirmation).toHaveBeenCalled();
    });

    it('should handle appointment not found error', async () => {
      const result = await notificationService.sendAppointmentConfirmationNotification('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle email service errors', async () => {
      const mockEmailError = new Error('SMTP connection failed');
      emailService.sendAppointmentConfirmation.mockRejectedValue(mockEmailError);

      const result = await notificationService.sendAppointmentConfirmationNotification(appointment._id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });
  });

  describe('sendAppointmentReminderNotification', () => {
    it('should send appointment reminder notification successfully', async () => {
      // Set appointment for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      appointment.date = tomorrow;
      await appointment.save();

      const mockEmailResult = { success: true, messageId: 'test-message-id' };
      emailService.sendAppointmentReminder.mockResolvedValue(mockEmailResult);

      const result = await notificationService.sendAppointmentReminderNotification(appointment._id);

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);
      expect(result.message).toBe('Appointment reminder notification sent successfully');
      expect(emailService.sendAppointmentReminder).toHaveBeenCalled();
    });

    it('should reject reminder for non-tomorrow appointments', async () => {
      // Set appointment for next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      appointment.date = nextWeek;
      await appointment.save();

      const result = await notificationService.sendAppointmentReminderNotification(appointment._id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment is not scheduled for tomorrow');
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();
    });

    it('should handle appointment not found error', async () => {
      const result = await notificationService.sendAppointmentReminderNotification('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });
  });

  describe('sendPaymentConfirmationNotification', () => {
    it('should send payment confirmation notification successfully', async () => {
      const mockEmailResult = { success: true, messageId: 'test-message-id' };
      emailService.sendPaymentConfirmation.mockResolvedValue(mockEmailResult);

      const result = await notificationService.sendPaymentConfirmationNotification(payment._id);

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);
      expect(result.message).toBe('Payment confirmation notification sent successfully');
      expect(emailService.sendPaymentConfirmation).toHaveBeenCalled();
    });

    it('should handle payment not found error', async () => {
      const result = await notificationService.sendPaymentConfirmationNotification('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });

    it('should handle email service errors', async () => {
      const mockEmailError = new Error('Email service unavailable');
      emailService.sendPaymentConfirmation.mockRejectedValue(mockEmailError);

      const result = await notificationService.sendPaymentConfirmationNotification(payment._id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service unavailable');
    });
  });

  describe('sendAppointmentCancellationNotification', () => {
    it('should send appointment cancellation notification successfully', async () => {
      const mockEmailResult = { success: true, messageId: 'test-message-id' };
      emailService.sendAppointmentCancellation.mockResolvedValue(mockEmailResult);

      const result = await notificationService.sendAppointmentCancellationNotification(appointment._id);

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);
      expect(result.message).toBe('Appointment cancellation notification sent successfully');
      expect(emailService.sendAppointmentCancellation).toHaveBeenCalled();
    });

    it('should handle appointment not found error', async () => {
      const result = await notificationService.sendAppointmentCancellationNotification('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle email service errors', async () => {
      const mockEmailError = new Error('Email delivery failed');
      emailService.sendAppointmentCancellation.mockRejectedValue(mockEmailError);

      const result = await notificationService.sendAppointmentCancellationNotification(appointment._id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email delivery failed');
    });
  });

  describe('sendDailyAppointmentReminders', () => {
    it('should send reminders for tomorrow appointments', async () => {
      // Create appointments for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointment1 = await createTestAppointment(patient, doctor, hospital);
      appointment1.date = tomorrow;
      appointment1.status = 'scheduled';
      appointment1.reminders.emailSent = false;
      await appointment1.save();

      const mockEmailResult = { success: true, messageId: 'test-message-id' };
      emailService.sendAppointmentReminder.mockResolvedValue(mockEmailResult);

      const result = await notificationService.sendDailyAppointmentReminders();

      expect(result.success).toBe(true);
      expect(result.totalAppointments).toBeGreaterThanOrEqual(1);
      expect(result.results).toHaveLength(result.totalAppointments);
      expect(result.message).toContain('Sent reminders for');
    });

    it('should handle no appointments for tomorrow', async () => {
      // Create appointment for next week (not tomorrow)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const appointment1 = await createTestAppointment(patient, doctor, hospital);
      appointment1.date = nextWeek;
      appointment1.status = 'scheduled';
      await appointment1.save();

      const result = await notificationService.sendDailyAppointmentReminders();

      expect(result.success).toBe(true);
      expect(result.totalAppointments).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.message).toBe('Sent reminders for 0 appointments');
    });
  });

  describe('sendNewAppointmentNotificationToDoctor', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should send new appointment notification to doctor', async () => {
      const result = await notificationService.sendNewAppointmentNotificationToDoctor(appointment._id);

      expect(result.success).toBe(true);
      expect(result.message).toBe('New appointment notification sent to doctor');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('New appointment notification for Dr.'),
        expect.objectContaining({
          appointmentId: appointment.appointmentID,
          patientName: patient.userName,
          date: appointment.date,
          time: appointment.time,
          type: appointment.type
        })
      );
    });

    it('should handle appointment not found error', async () => {
      const result = await notificationService.sendNewAppointmentNotificationToDoctor('507f1f77bcf86cd799439011');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });
  });

  describe('sendPaymentIssueNotification', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should send payment issue notification to hospital staff', async () => {
      const issue = 'Payment processing failed';
      const result = await notificationService.sendPaymentIssueNotification(payment._id, issue);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment issue notification sent to hospital staff');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment issue notification for hospital'),
        expect.objectContaining({
          paymentId: payment.paymentID,
          patientName: patient.userName,
          amount: payment.amount,
          issue: issue
        })
      );
    });

    it('should handle payment not found error', async () => {
      const result = await notificationService.sendPaymentIssueNotification('507f1f77bcf86cd799439011', 'Test issue');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ObjectId format', async () => {
      const result = await notificationService.sendAppointmentConfirmationNotification('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle null appointment ID', async () => {
      const result = await notificationService.sendAppointmentConfirmationNotification(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle undefined payment ID', async () => {
      const result = await notificationService.sendPaymentConfirmationNotification(undefined);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });

  describe('Module Exports', () => {
    it('should export all required functions', () => {
      expect(notificationService).toHaveProperty('sendAppointmentConfirmationNotification');
      expect(notificationService).toHaveProperty('sendAppointmentReminderNotification');
      expect(notificationService).toHaveProperty('sendPaymentConfirmationNotification');
      expect(notificationService).toHaveProperty('sendAppointmentCancellationNotification');
      expect(notificationService).toHaveProperty('sendDailyAppointmentReminders');
      expect(notificationService).toHaveProperty('sendNewAppointmentNotificationToDoctor');
      expect(notificationService).toHaveProperty('sendPaymentIssueNotification');
    });

    it('should export functions as callable', () => {
      expect(typeof notificationService.sendAppointmentConfirmationNotification).toBe('function');
      expect(typeof notificationService.sendAppointmentReminderNotification).toBe('function');
      expect(typeof notificationService.sendPaymentConfirmationNotification).toBe('function');
      expect(typeof notificationService.sendAppointmentCancellationNotification).toBe('function');
      expect(typeof notificationService.sendDailyAppointmentReminders).toBe('function');
      expect(typeof notificationService.sendNewAppointmentNotificationToDoctor).toBe('function');
      expect(typeof notificationService.sendPaymentIssueNotification).toBe('function');
    });
  });
});