const { 
  sendAppointmentConfirmation, 
  sendAppointmentReminder, 
  sendPaymentConfirmation, 
  sendAppointmentCancellation 
} = require('./emailService');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');

// Send appointment confirmation notification
const sendAppointmentConfirmationNotification = async (appointmentId) => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Send email notification
    const emailResult = await sendAppointmentConfirmation(appointment);
    
    // Update appointment with notification status
    appointment.reminders.emailSent = true;
    appointment.reminders.reminderDate = new Date();
    await appointment.save();

    return {
      success: true,
      emailSent: emailResult.success,
      message: 'Appointment confirmation notification sent successfully'
    };
  } catch (error) {
    console.error('Error sending appointment confirmation notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send appointment reminder notification
const sendAppointmentReminderNotification = async (appointmentId) => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Check if appointment is tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointmentDate = new Date(appointment.date);
    
    if (appointmentDate.toDateString() !== tomorrow.toDateString()) {
      return {
        success: false,
        error: 'Appointment is not scheduled for tomorrow'
      };
    }

    // Send email notification
    const emailResult = await sendAppointmentReminder(appointment);
    
    // Update appointment with reminder status
    appointment.reminders.emailSent = true;
    appointment.reminders.reminderDate = new Date();
    await appointment.save();

    return {
      success: true,
      emailSent: emailResult.success,
      message: 'Appointment reminder notification sent successfully'
    };
  } catch (error) {
    console.error('Error sending appointment reminder notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send payment confirmation notification
const sendPaymentConfirmationNotification = async (paymentId) => {
  try {
    const payment = await Payment.findById(paymentId)
      .populate('patientID', 'userName email phone')
      .populate('appointmentID', 'appointmentID date time')
      .populate('hospitalID', 'name address');

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Send email notification
    const emailResult = await sendPaymentConfirmation(payment);

    return {
      success: true,
      emailSent: emailResult.success,
      message: 'Payment confirmation notification sent successfully'
    };
  } catch (error) {
    console.error('Error sending payment confirmation notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send appointment cancellation notification
const sendAppointmentCancellationNotification = async (appointmentId) => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Send email notification
    const emailResult = await sendAppointmentCancellation(appointment);

    return {
      success: true,
      emailSent: emailResult.success,
      message: 'Appointment cancellation notification sent successfully'
    };
  } catch (error) {
    console.error('Error sending appointment cancellation notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send daily appointment reminders (to be called by a cron job)
const sendDailyAppointmentReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all appointments scheduled for tomorrow
    const appointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['scheduled', 'confirmed'] },
      'reminders.emailSent': { $ne: true }
    }).populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    const results = [];
    for (const appointment of appointments) {
      const result = await sendAppointmentReminderNotification(appointment._id);
      results.push({
        appointmentId: appointment._id,
        patientEmail: appointment.patientID.email,
        ...result
      });
    }

    return {
      success: true,
      totalAppointments: appointments.length,
      results: results,
      message: `Sent reminders for ${appointments.length} appointments`
    };
  } catch (error) {
    console.error('Error sending daily appointment reminders:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send notification to healthcare professionals about new appointments
const sendNewAppointmentNotificationToDoctor = async (appointmentId) => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address');

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // This would typically send a notification to the doctor
    // For now, we'll just log it
    console.log(`New appointment notification for Dr. ${appointment.doctorID.userName}:`, {
      appointmentId: appointment.appointmentID,
      patientName: appointment.patientID.userName,
      date: appointment.date,
      time: appointment.time,
      type: appointment.type
    });

    return {
      success: true,
      message: 'New appointment notification sent to doctor'
    };
  } catch (error) {
    console.error('Error sending new appointment notification to doctor:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send notification to hospital staff about payment issues
const sendPaymentIssueNotification = async (paymentId, issue) => {
  try {
    const payment = await Payment.findById(paymentId)
      .populate('patientID', 'userName email phone')
      .populate('hospitalID', 'name address contactInfo');

    if (!payment) {
      throw new Error('Payment not found');
    }

    // This would typically send a notification to hospital staff
    // For now, we'll just log it
    console.log(`Payment issue notification for hospital ${payment.hospitalID.name}:`, {
      paymentId: payment.paymentID,
      patientName: payment.patientID.userName,
      amount: payment.amount,
      issue: issue
    });

    return {
      success: true,
      message: 'Payment issue notification sent to hospital staff'
    };
  } catch (error) {
    console.error('Error sending payment issue notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendAppointmentConfirmationNotification,
  sendAppointmentReminderNotification,
  sendPaymentConfirmationNotification,
  sendAppointmentCancellationNotification,
  sendDailyAppointmentReminders,
  sendNewAppointmentNotificationToDoctor,
  sendPaymentIssueNotification
};
