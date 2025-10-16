const mongoose = require('mongoose');
const User = require('./User');

const healthcareProfessionalSchema = new mongoose.Schema({
  professionalID: {
    type: String,
    unique: true,
    required: true
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required'],
    enum: [
      'Cardiology',
      'Dermatology',
      'Endocrinology',
      'Gastroenterology',
      'General Medicine',
      'Gynecology',
      'Neurology',
      'Oncology',
      'Orthopedics',
      'Pediatrics',
      'Psychiatry',
      'Radiology',
      'Surgery',
      'Urology',
      'Emergency Medicine',
      'Anesthesiology',
      'Pathology',
      'Physical Therapy',
      'Nursing'
    ]
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  qualifications: [{
    degree: { type: String, required: true },
    institution: { type: String, required: true },
    year: { type: Number, required: true }
  }],
  workingHours: {
    monday: { start: String, end: String, available: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, available: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, available: { type: Boolean, default: true } },
    thursday: { start: String, end: String, available: { type: Boolean, default: true } },
    friday: { start: String, end: String, available: { type: Boolean, default: true } },
    saturday: { start: String, end: String, available: { type: Boolean, default: false } },
    sunday: { start: String, end: String, available: { type: Boolean, default: false } }
  },
  consultationFee: {
    type: Number,
    required: true,
    min: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  bio: String,
  languages: [{
    type: String,
    default: ['English']
  }],
  hospitalID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: false
  }
});

// Generate professional ID before saving
healthcareProfessionalSchema.pre('save', async function(next) {
  if (!this.professionalID) {
    const count = await mongoose.models.HealthcareProfessional.countDocuments();
    this.professionalID = `DOC${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = User.discriminator('healthcare_professional', healthcareProfessionalSchema);
