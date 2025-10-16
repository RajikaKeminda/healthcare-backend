const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Hospital = require('../models/Hospital');
const HealthcareProfessional = require('../models/HealthcareProfessional');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all hospitals
router.get('/', verifyToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['public', 'private', 'teaching', 'specialty']),
  query('city').optional().isString(),
  query('specialization').optional().isString()
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

    // Build filter
    let filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.city) filter['address.city'] = new RegExp(req.query.city, 'i');
    if (req.query.specialization) filter.specializations = req.query.specialization;

    const hospitals = await Hospital.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Hospital.countDocuments(filter);

    res.json({
      success: true,
      data: {
        hospitals,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching hospitals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get hospital by ID
router.get('/:hospitalID', verifyToken, async (req, res) => {
  try {
    const { hospitalID } = req.params;

    const hospital = await Hospital.findById(hospitalID);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      data: { hospital }
    });

  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get doctors by hospital and specialization
router.get('/:hospitalID/doctors', verifyToken, [
  query('specialization').optional().isString(),
  query('available').optional().isBoolean()
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

    const { hospitalID } = req.params;
    const { specialization, available } = req.query;

    // Verify hospital exists
    const hospital = await Hospital.findById(hospitalID);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Build filter for doctors
    let filter = { 
      role: 'healthcare_professional',
      isActive: true
    };
    
    if (specialization) filter.specialization = specialization;
    if (available !== undefined) filter.isAvailable = available === 'true';

    const doctors = await HealthcareProfessional.find(filter)
      .select('userName email specialization consultationFee isAvailable workingHours bio languages')
      .sort({ specialization: 1, userName: 1 });

    res.json({
      success: true,
      data: {
        hospital: {
          id: hospital._id,
          name: hospital.name,
          address: hospital.address,
          specializations: hospital.specializations
        },
        doctors
      }
    });

  } catch (error) {
    console.error('Get hospital doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching hospital doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new hospital (admin only)
router.post('/', verifyToken, authorize('healthcare_manager'), [
  body('name').notEmpty().withMessage('Hospital name is required'),
  body('type').isIn(['public', 'private', 'teaching', 'specialty']).withMessage('Invalid hospital type'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('Zip code is required'),
  body('contactInfo.phone').notEmpty().withMessage('Phone number is required'),
  body('contactInfo.email').isEmail().withMessage('Valid email is required'),
  body('capacity.totalBeds').isInt({ min: 1 }).withMessage('Total beds must be a positive integer')
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

    const hospital = new Hospital(req.body);
    await hospital.save();

    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      data: { hospital }
    });

  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update hospital (admin only)
router.put('/:hospitalID', verifyToken, authorize('healthcare_manager'), [
  body('name').optional().notEmpty().withMessage('Hospital name cannot be empty'),
  body('type').optional().isIn(['public', 'private', 'teaching', 'specialty']).withMessage('Invalid hospital type'),
  body('contactInfo.email').optional().isEmail().withMessage('Valid email is required')
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

    const { hospitalID } = req.params;
    const updates = req.body;

    const hospital = await Hospital.findByIdAndUpdate(
      hospitalID,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital updated successfully',
      data: { hospital }
    });

  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get available specializations
router.get('/specializations/list', verifyToken, async (req, res) => {
  try {
    const specializations = await HealthcareProfessional.distinct('specialization', {
      role: 'healthcare_professional',
      isActive: true
    });

    res.json({
      success: true,
      data: { specializations: specializations.sort() }
    });

  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching specializations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
