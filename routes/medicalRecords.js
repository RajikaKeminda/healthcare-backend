const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const MedicalRecord = require('../models/MedicalRecord');
const { verifyToken, authorize, authorizeResource } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/medical-records');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only specific file types
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all medical records with filtering and pagination
router.get('/', verifyToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('patientID').optional().isMongoId().withMessage('Invalid patient ID'),
  query('doctorID').optional().isMongoId().withMessage('Invalid doctor ID'),
  query('dateFrom').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('dateTo').optional().isISO8601().withMessage('Date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter based on user role
    let filter = {};
    
    if (req.user.role === 'patient') {
      filter.patientID = req.user._id;
    } else if (req.user.role === 'healthcare_professional') {
      filter.doctorID = req.user._id;
    }

    // Add query filters
    if (req.query.patientID) filter.patientID = req.query.patientID;
    if (req.query.doctorID) filter.doctorID = req.query.doctorID;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.visitDate = {};
      if (req.query.dateFrom) filter.visitDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.visitDate.$lte = new Date(req.query.dateTo);
    }

    const medicalRecords = await MedicalRecord.find(filter)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address')
      .populate('appointmentID', 'appointmentID date time')
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MedicalRecord.countDocuments(filter);

    res.json({
      success: true,
      data: {
        medicalRecords,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching medical records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new medical record
router.post('/', verifyToken, authorize('healthcare_professional'), [
  body('patientID').isMongoId().withMessage('Invalid patient ID'),
  body('hospitalID').isMongoId().withMessage('Invalid hospital ID'),
  body('chiefComplaint').notEmpty().withMessage('Chief complaint is required'),
  body('diagnosis').isArray().withMessage('Diagnosis must be an array'),
  body('diagnosis.*.description').notEmpty().withMessage('Diagnosis description is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const recordID = uuidv4();
    const medicalRecordData = {
      ...req.body,
      recordID,
      doctorID: req.user._id,
      visitDate: req.body.visitDate || new Date()
    };

    const medicalRecord = new MedicalRecord(medicalRecordData);
    await medicalRecord.save();

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'created'
    });
    await medicalRecord.save();

    // Populate the medical record data
    await medicalRecord.populate('patientID', 'userName email phone');
    await medicalRecord.populate('doctorID', 'userName email specialization');
    await medicalRecord.populate('hospitalID', 'name address');

    res.status(201).json({
      success: true,
      message: 'Medical record created successfully',
      data: { medicalRecord }
    });

  } catch (error) {
    console.error('Create medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating medical record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update medical record
router.put('/:recordID', verifyToken, [
  body('chiefComplaint').optional().notEmpty().withMessage('Chief complaint cannot be empty'),
  body('diagnosis').optional().isArray().withMessage('Diagnosis must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { recordID } = req.params;
    const updates = req.body;

    const medicalRecord = await MedicalRecord.findById(recordID);
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && medicalRecord.patientID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && medicalRecord.doctorID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update medical record
    Object.keys(updates).forEach(key => {
      if (key === 'visitDate') {
        medicalRecord[key] = new Date(updates[key]);
      } else {
        medicalRecord[key] = updates[key];
      }
    });

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'edited'
    });

    await medicalRecord.save();

    // Populate the medical record data
    await medicalRecord.populate('patientID', 'userName email phone');
    await medicalRecord.populate('doctorID', 'userName email specialization');
    await medicalRecord.populate('hospitalID', 'name address');

    res.json({
      success: true,
      message: 'Medical record updated successfully',
      data: { medicalRecord }
    });

  } catch (error) {
    console.error('Update medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating medical record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get medical record by ID
router.get('/:recordID', verifyToken, async (req, res) => {
  try {
    const { recordID } = req.params;

    const medicalRecord = await MedicalRecord.findById(recordID)
      .populate('patientID', 'userName email phone')
      .populate('doctorID', 'userName email specialization')
      .populate('hospitalID', 'name address')
      .populate('appointmentID', 'appointmentID date time');

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && medicalRecord.patientID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && medicalRecord.doctorID._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'viewed'
    });
    await medicalRecord.save();

    res.json({
      success: true,
      data: { medicalRecord }
    });

  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching medical record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload file attachment
router.post('/:recordID/attachments', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { recordID } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const medicalRecord = await MedicalRecord.findById(recordID);
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && medicalRecord.patientID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && medicalRecord.doctorID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add attachment to medical record
    const attachment = {
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl: `/uploads/medical-records/${req.file.filename}`,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    };

    medicalRecord.attachments.push(attachment);

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'edited'
    });

    await medicalRecord.save();

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: { attachment }
    });

  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add progress note
router.post('/:recordID/progress-notes', verifyToken, [
  body('note').notEmpty().withMessage('Progress note is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { recordID } = req.params;
    const { note } = req.body;

    const medicalRecord = await MedicalRecord.findById(recordID);
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient' && medicalRecord.patientID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'healthcare_professional' && medicalRecord.doctorID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add progress note
    const progressNote = {
      date: new Date(),
      note,
      author: req.user._id
    };

    medicalRecord.progressNotes.push(progressNote);

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'edited'
    });

    await medicalRecord.save();

    res.json({
      success: true,
      message: 'Progress note added successfully',
      data: { progressNote }
    });

  } catch (error) {
    console.error('Add progress note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding progress note',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete medical record (soft delete)
router.delete('/:recordID', verifyToken, authorize('healthcare_professional', 'healthcare_manager'), async (req, res) => {
  try {
    const { recordID } = req.params;

    const medicalRecord = await MedicalRecord.findById(recordID);
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Check permissions
    if (req.user.role === 'healthcare_professional' && medicalRecord.doctorID.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Soft delete
    medicalRecord.isActive = false;

    // Log access
    medicalRecord.accessLog.push({
      accessedBy: req.user._id,
      action: 'deleted'
    });

    await medicalRecord.save();

    res.json({
      success: true,
      message: 'Medical record deleted successfully'
    });

  } catch (error) {
    console.error('Delete medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting medical record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
