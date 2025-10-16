const nodemailer = require('nodemailer');

// Create transporter (using Gmail as example)
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
};

// Email templates
const emailTemplates = {
  appointmentConfirmation: (appointment) => ({
    subject: 'Appointment Confirmation - Smart Healthcare System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Appointment Confirmed</h2>
        <p>Dear ${appointment.patientID.userName},</p>
        <p>Your appointment has been successfully confirmed. Here are the details:</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details</h3>
          <p><strong>Appointment ID:</strong> ${appointment.appointmentID}</p>
          <p><strong>Doctor:</strong> Dr. ${appointment.doctorID.userName}</p>
          <p><strong>Specialization:</strong> ${appointment.doctorID.specialization}</p>
          <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointment.time}</p>
          <p><strong>Type:</strong> ${appointment.type}</p>
          ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
        </div>
        
        <p>Please arrive 15 minutes before your scheduled time.</p>
        <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
        
        <p>Best regards,<br>Smart Healthcare System</p>
      </div>
    `
  }),

  appointmentReminder: (appointment) => ({
    subject: 'Appointment Reminder - Tomorrow',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Appointment Reminder</h2>
        <p>Dear ${appointment.patientID.userName},</p>
        <p>This is a reminder that you have an appointment tomorrow:</p>
        
        <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details</h3>
          <p><strong>Doctor:</strong> Dr. ${appointment.doctorID.userName}</p>
          <p><strong>Specialization:</strong> ${appointment.doctorID.specialization}</p>
          <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointment.time}</p>
        </div>
        
        <p>Please remember to bring your ID and any relevant medical documents.</p>
        
        <p>Best regards,<br>Smart Healthcare System</p>
      </div>
    `
  }),

  paymentConfirmation: (payment) => ({
    subject: 'Payment Confirmation - Smart Healthcare System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Payment Confirmed</h2>
        <p>Dear ${payment.patientID.userName},</p>
        <p>Your payment has been successfully processed. Here are the details:</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Payment ID:</strong> ${payment.paymentID}</p>
          <p><strong>Amount:</strong> LKR ${payment.amount.toFixed(2)}</p>
          <p><strong>Method:</strong> ${payment.method.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date(payment.createdAt).toLocaleDateString()}</p>
          ${payment.transactionReference ? `<p><strong>Transaction Reference:</strong> ${payment.transactionReference}</p>` : ''}
        </div>
        
        <p>A receipt has been generated and is available in your account.</p>
        
        <p>Best regards,<br>Smart Healthcare System</p>
      </div>
    `
  }),

  appointmentCancellation: (appointment) => ({
    subject: 'Appointment Cancelled - Smart Healthcare System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Appointment Cancelled</h2>
        <p>Dear ${appointment.patientID.userName},</p>
        <p>Your appointment has been cancelled. Here are the details:</p>
        
        <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Cancelled Appointment</h3>
          <p><strong>Appointment ID:</strong> ${appointment.appointmentID}</p>
          <p><strong>Doctor:</strong> Dr. ${appointment.doctorID.userName}</p>
          <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointment.time}</p>
          <p><strong>Reason:</strong> ${appointment.cancellation.reason}</p>
        </div>
        
        ${appointment.cancellation.refundAmount ? `
          <p><strong>Refund Amount:</strong> LKR ${appointment.cancellation.refundAmount.toFixed(2)}</p>
          <p>Your refund will be processed within 3-5 business days.</p>
        ` : ''}
        
        <p>If you need to reschedule, please contact us or book a new appointment through our system.</p>
        
        <p>Best regards,<br>Smart Healthcare System</p>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = emailTemplates[template](data);
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: to,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send appointment confirmation
const sendAppointmentConfirmation = async (appointment) => {
  return await sendEmail(appointment.patientID.email, 'appointmentConfirmation', appointment);
};

// Send appointment reminder
const sendAppointmentReminder = async (appointment) => {
  return await sendEmail(appointment.patientID.email, 'appointmentReminder', appointment);
};

// Send payment confirmation
const sendPaymentConfirmation = async (payment) => {
  return await sendEmail(payment.patientID.email, 'paymentConfirmation', payment);
};

// Send appointment cancellation
const sendAppointmentCancellation = async (appointment) => {
  return await sendEmail(appointment.patientID.email, 'appointmentCancellation', appointment);
};

// Send bulk emails (for notifications to multiple recipients)
const sendBulkEmails = async (recipients, template, data) => {
  const results = [];
  for (const recipient of recipients) {
    const result = await sendEmail(recipient.email, template, { ...data, recipient });
    results.push({ recipient: recipient.email, ...result });
  }
  return results;
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendPaymentConfirmation,
  sendAppointmentCancellation,
  sendBulkEmails
};
