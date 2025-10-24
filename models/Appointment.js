const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentID: {
    type: String,
    unique: true,
    required: false
  },
  patientID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient ID is required']
  },
  doctorID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  hospitalID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  time: {
    type: String,
    required: [true, 'Appointment time is required']
  },
  duration: {
    type: Number,
    default: 30, // minutes
    min: 15,
    max: 120
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['regular', 'urgent', 'follow_up', 'consultation', 'procedure'],
    default: 'regular'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  symptoms: [{
    type: String
  }],
  reservationFee: {
    amount: { type: Number, required: true, min: 0 },
    paid: { type: Boolean, default: false },
    paymentDate: Date,
    paymentMethod: String
  },
  consultationFee: {
    amount: { type: Number, min: 0 },
    paid: { type: Boolean, default: false },
    paymentDate: Date,
    paymentMethod: String
  },
  reminders: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    reminderDate: Date
  },
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['patient', 'doctor', 'hospital', 'system']
    },
    reason: String,
    cancelledAt: Date,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'declined'],
      default: 'pending'
    }
  },
  followUp: {
    required: { type: Boolean, default: false },
    scheduledDate: Date,
    notes: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate appointment ID before saving
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentID) {
    const count = await this.constructor.countDocuments();
    this.appointmentID = `APT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Update timestamp on save
appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
appointmentSchema.index({ patientID: 1, date: 1 });
appointmentSchema.index({ doctorID: 1, date: 1 });
appointmentSchema.index({ hospitalID: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });

// Virtual for checking if appointment is in the past
appointmentSchema.virtual('isPast').get(function() {
  return new Date(this.date) < new Date();
});

// Virtual for checking if appointment is today
appointmentSchema.virtual('isToday').get(function() {
  const today = new Date();
  const appointmentDate = new Date(this.date);
  return appointmentDate.toDateString() === today.toDateString();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
