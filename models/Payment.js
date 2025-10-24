const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentID: {
    type: String,
    unique: true,
    required: false
  },
  patientID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient ID is required']
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
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: 0
  },
  currency: {
    type: String,
    default: 'LKR',
    enum: ['LKR', 'USD', 'EUR']
  },
  method: {
    type: String,
    enum: ['credit_card', 'debit_card', 'cash', 'insurance', 'government', 'bank_transfer', 'digital_wallet'],
    required: [true, 'Payment method is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  transactionReference: {
    type: String,
    unique: true,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  gatewayResponse: {
    gateway: String,
    gatewayTransactionId: String,
    gatewayStatus: String,
    gatewayMessage: String,
    processedAt: Date
  },
  billingDetails: {
    services: [{
      serviceName: { type: String, required: true },
      serviceCode: String,
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, required: true },
      totalPrice: { type: Number, required: true }
    }],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    claimNumber: String,
    coveredAmount: Number,
    patientResponsibility: Number,
    deductible: Number,
    copay: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'partial'],
      default: 'pending'
    }
  },
  receipt: {
    generated: { type: Boolean, default: false },
    receiptNumber: String,
    generatedAt: Date,
    fileUrl: String
  },
  refund: {
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date,
    refundMethod: String,
    refundReference: String
  },
  notes: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Generate payment ID before saving
paymentSchema.pre('save', async function(next) {
  if (!this.paymentID) {
    const count = await this.constructor.countDocuments();
    this.paymentID = `PAY${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Generate transaction reference for non-cash payments
paymentSchema.pre('save', async function(next) {
  if (!this.transactionReference && this.method !== 'cash') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionReference = `TXN${timestamp}${random}`;
  }
  next();
});

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
paymentSchema.index({ patientID: 1, createdAt: -1 });
paymentSchema.index({ appointmentID: 1 });
paymentSchema.index({ hospitalID: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ transactionReference: 1 });

// Virtual for payment age
paymentSchema.virtual('paymentAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for checking if payment is overdue
paymentSchema.virtual('isOverdue').get(function() {
  return this.status === 'pending' && this.paymentAge > 7; // 7 days
});

// Method to calculate total from services
paymentSchema.methods.calculateTotal = function() {
  const subtotal = this.billingDetails.services.reduce((sum, service) => {
    return sum + (service.unitPrice * service.quantity);
  }, 0);
  
  this.billingDetails.subtotal = subtotal;
  this.billingDetails.total = subtotal + this.billingDetails.tax - this.billingDetails.discount;
  this.amount = this.billingDetails.total;
  
  return this.billingDetails.total;
};

module.exports = mongoose.model('Payment', paymentSchema);
