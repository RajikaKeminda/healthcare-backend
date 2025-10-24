const mongoose = require('mongoose');
const User = require('./User');

const hospitalStaffSchema = new mongoose.Schema({
  staffID: {
    type: String,
    unique: true,
    required: false
  },
  staffRole: {
    type: String,
    required: [true, 'Staff role is required'],
    enum: [
      'receptionist',
      'nurse',
      'lab_technician',
      'pharmacist',
      'administrator',
      'security',
      'maintenance',
      'cleaner',
      'accountant',
      'it_support'
    ]
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  employeeID: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true
  },
  hireDate: {
    type: Date,
    required: [true, 'Hire date is required']
  },
  salary: {
    type: Number,
    min: 0
  },
  workingHours: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'night', 'flexible'],
    default: 'morning'
  },
  permissions: [{
    type: String,
    enum: [
      'view_patients',
      'edit_patients',
      'view_appointments',
      'manage_appointments',
      'view_payments',
      'process_payments',
      'view_reports',
      'manage_inventory',
      'system_admin'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  }
});

// Generate staff ID before saving
hospitalStaffSchema.pre('save', async function(next) {
  if (!this.staffID) {
    const count = await this.constructor.countDocuments();
    this.staffID = `STAFF${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = User.discriminator('hospital_staff', hospitalStaffSchema);
