const mongoose = require('mongoose');
const User = require('./User');

const patientSchema = new mongoose.Schema({
  patientID: {
    type: String,
    unique: true,
    required: false
  },
  medicalHistory: [{
    condition: { type: String, required: true },
    diagnosisDate: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ['active', 'resolved', 'chronic'], 
      default: 'active' 
    },
    notes: String
  }],
  allergies: [{
    allergen: { type: String, required: true },
    severity: { 
      type: String, 
      enum: ['mild', 'moderate', 'severe'], 
      required: true 
    },
    reaction: String
  }],
  emergencyContact: {
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true },
    email: String
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  height: {
    type: Number,
    min: 0,
    max: 300
  },
  weight: {
    type: Number,
    min: 0,
    max: 1000
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    expiryDate: Date
  },
  preferredLanguage: {
    type: String,
    default: 'English'
  }
});

// Generate patient ID before saving
patientSchema.pre('save', async function(next) {
  if (!this.patientID) {
    const count = await this.constructor.countDocuments();
    this.patientID = `PAT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = User.discriminator('patient', patientSchema);
