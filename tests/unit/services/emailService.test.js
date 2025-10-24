const nodemailer = require('nodemailer');
const emailService = require('../../../services/emailService');
const { createTestUser, createTestHospital, createTestAppointment, createTestPayment } = require('../../utils/testHelpers');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn()
}));

require('../../setup');

describe('Email Service', () => {
  let mockTransporter, patient, doctor, hospital, appointment, payment;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    appointment = await createTestAppointment(patient, doctor, hospital);
    payment = await createTestPayment(patient, hospital, appointment);

    // Mock transporter
    mockTransporter = {
      sendMail: jest.fn()
    };
    nodemailer.createTransporter.mockReturnValue(mockTransporter);

    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: 'test@example.com',
        subject: expect.any(String),
        html: expect.any(String)
      });
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    it('should use correct from address', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: process.env.EMAIL_USER || 'your-email@gmail.com'
        })
      );
    });
  });

  describe('sendAppointmentConfirmation', () => {
    it('should send appointment confirmation email', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendAppointmentConfirmation(appointment);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: patient.email,
          subject: expect.stringContaining('Appointment Confirmation')
        })
      );
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('Email delivery failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendAppointmentConfirmation(appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email delivery failed');
    });
  });

  describe('sendAppointmentReminder', () => {
    it('should send appointment reminder email', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendAppointmentReminder(appointment);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: patient.email,
          subject: expect.stringContaining('Appointment Reminder')
        })
      );
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('Reminder email failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendAppointmentReminder(appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reminder email failed');
    });
  });

  describe('sendPaymentConfirmation', () => {
    it('should send payment confirmation email', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendPaymentConfirmation(payment);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: patient.email,
          subject: expect.stringContaining('Payment Confirmation')
        })
      );
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('Payment email failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendPaymentConfirmation(payment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment email failed');
    });
  });

  describe('sendAppointmentCancellation', () => {
    it('should send appointment cancellation email', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const result = await emailService.sendAppointmentCancellation(appointment);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: patient.email,
          subject: expect.stringContaining('Appointment Cancelled')
        })
      );
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('Cancellation email failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendAppointmentCancellation(appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancellation email failed');
    });
  });

  describe('sendBulkEmails', () => {
    it('should send bulk emails successfully', async () => {
      const recipients = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' }
      ];

      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      const results = await emailService.sendBulkEmails(recipients, 'appointmentConfirmation', appointment);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].recipient).toBe('user1@example.com');
      expect(results[1].recipient).toBe('user2@example.com');
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure in bulk emails', async () => {
      const recipients = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' }
      ];

      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: 'success-id' })
        .mockRejectedValueOnce(new Error('Email failed'));

      const results = await emailService.sendBulkEmails(recipients, 'appointmentConfirmation', appointment);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Email failed');
    });

    it('should handle empty recipients array', async () => {
      const results = await emailService.sendBulkEmails([], 'appointmentConfirmation', appointment);

      expect(results).toHaveLength(0);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid email addresses', async () => {
      const mockError = new Error('Invalid email address');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendEmail('invalid-email', 'appointmentConfirmation', appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('should handle network timeouts', async () => {
      const mockError = new Error('Connection timeout');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('Module Exports', () => {
    it('should export all required functions', () => {
      expect(emailService).toHaveProperty('sendEmail');
      expect(emailService).toHaveProperty('sendAppointmentConfirmation');
      expect(emailService).toHaveProperty('sendAppointmentReminder');
      expect(emailService).toHaveProperty('sendPaymentConfirmation');
      expect(emailService).toHaveProperty('sendAppointmentCancellation');
      expect(emailService).toHaveProperty('sendBulkEmails');
    });

    it('should export functions as callable', () => {
      expect(typeof emailService.sendEmail).toBe('function');
      expect(typeof emailService.sendAppointmentConfirmation).toBe('function');
      expect(typeof emailService.sendAppointmentReminder).toBe('function');
      expect(typeof emailService.sendPaymentConfirmation).toBe('function');
      expect(typeof emailService.sendAppointmentCancellation).toBe('function');
      expect(typeof emailService.sendBulkEmails).toBe('function');
    });
  });

  describe('Console Logging', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log successful email sending', async () => {
      const mockResult = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockResult);

      await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(consoleSpy).toHaveBeenCalledWith('Email sent successfully:', 'test-message-id');
    });

    it('should log email sending errors', async () => {
      const mockError = new Error('Email failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await emailService.sendEmail('test@example.com', 'appointmentConfirmation', appointment);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending email:', mockError);

      consoleErrorSpy.mockRestore();
    });
  });
});