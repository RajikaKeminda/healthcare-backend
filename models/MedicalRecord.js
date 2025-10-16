const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  recordID: {
    type: String,
    unique: true,
    required: true
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
  appointmentID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  hospitalID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital ID is required']
  },
  visitDate: {
    type: Date,
    required: [true, 'Visit date is required'],
    default: Date.now
  },
  chiefComplaint: {
    type: String,
    required: [true, 'Chief complaint is required'],
    maxlength: 500
  },
  historyOfPresentIllness: {
    type: String,
    maxlength: 2000
  },
  physicalExamination: {
    vitalSigns: {
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number
    },
    generalAppearance: String,
    cardiovascular: String,
    respiratory: String,
    gastrointestinal: String,
    neurological: String,
    musculoskeletal: String,
    skin: String,
    other: String
  },
  diagnosis: [{
    primary: { type: Boolean, default: false },
    code: String, // ICD-10 code
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['primary', 'secondary', 'differential', 'rule_out'],
      default: 'primary'
    }
  }],
  treatmentPlan: {
    medications: [{
      name: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String, required: true },
      instructions: String,
      prescribedDate: { type: Date, default: Date.now }
    }],
    procedures: [{
      name: { type: String, required: true },
      description: String,
      scheduledDate: Date,
      status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled'],
        default: 'scheduled'
      }
    }],
    lifestyleRecommendations: [String],
    followUpInstructions: String,
    nextAppointment: Date
  },
  labResults: [{
    testName: { type: String, required: true },
    testDate: { type: Date, required: true },
    results: mongoose.Schema.Types.Mixed,
    normalRange: String,
    status: {
      type: String,
      enum: ['normal', 'abnormal', 'critical'],
      default: 'normal'
    },
    notes: String,
    fileAttachment: String // URL to uploaded file
  }],
  imagingResults: [{
    type: { type: String, required: true }, // X-ray, MRI, CT, etc.
    bodyPart: { type: String, required: true },
    date: { type: Date, required: true },
    findings: String,
    impression: String,
    recommendations: String,
    fileAttachment: String // URL to uploaded file
  }],
  progressNotes: [{
    date: { type: Date, default: Date.now },
    note: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  allergies: [{
    allergen: { type: String, required: true },
    reaction: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true
    }
  }],
  attachments: [{
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: Number,
    fileUrl: { type: String, required: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: { type: Date, default: Date.now }
  }],
  accessLog: [{
    accessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    accessedAt: { type: Date, default: Date.now },
    action: {
      type: String,
      enum: ['viewed', 'edited', 'printed', 'exported', 'created']
    }
  }],
  isActive: {
    type: Boolean,
    default: true
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

// Generate record ID before saving
medicalRecordSchema.pre('save', async function(next) {
  if (!this.recordID) {
    const count = await mongoose.models.MedicalRecord.countDocuments();
    this.recordID = `MR${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Update timestamp on save
medicalRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
medicalRecordSchema.index({ patientID: 1, visitDate: -1 });
medicalRecordSchema.index({ doctorID: 1, visitDate: -1 });
medicalRecordSchema.index({ hospitalID: 1, visitDate: -1 });

// Virtual for patient age at visit
medicalRecordSchema.virtual('patientAgeAtVisit').get(function() {
  // This would need to be populated with patient data
  return null;
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
