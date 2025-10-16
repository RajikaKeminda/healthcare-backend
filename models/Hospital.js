const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  hospitalID: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'Sri Lanka' }
  },
  type: {
    type: String,
    enum: ['public', 'private', 'teaching', 'specialty'],
    required: [true, 'Hospital type is required']
  },
  capacity: {
    totalBeds: { type: Number, required: true, min: 1 },
    occupiedBeds: { type: Number, default: 0, min: 0 },
    icuBeds: { type: Number, default: 0, min: 0 },
    emergencyBeds: { type: Number, default: 0, min: 0 }
  },
  contactInfo: {
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: String,
    emergencyHotline: String
  },
  facilities: [{
    type: String,
    enum: [
      'emergency',
      'icu',
      'surgery',
      'radiology',
      'laboratory',
      'pharmacy',
      'physiotherapy',
      'dental',
      'mental_health',
      'maternity',
      'pediatrics',
      'cardiology',
      'oncology',
      'orthopedics'
    ]
  }],
  specializations: [{
    type: String,
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
  }],
  operatingHours: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } }
  },
  emergencyServices: {
    available: { type: Boolean, default: true },
    hours: { type: String, default: '24/7' }
  },
  accreditation: [{
    body: String,
    certificate: String,
    expiryDate: Date
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

// Generate hospital ID before saving
hospitalSchema.pre('save', async function(next) {
  if (!this.hospitalID) {
    const count = await mongoose.models.Hospital.countDocuments();
    this.hospitalID = `HOSP${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Update timestamp on save
hospitalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);
