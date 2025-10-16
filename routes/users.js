var express = require('express');
var router = express.Router();
const User = require('../models/User');
const Patient = require('../models/Patient');
const HealthcareProfessional = require('../models/HealthcareProfessional');
const HospitalStaff = require('../models/HospitalStaff');
const { verifyToken, authorize } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// GET /api/users
// Optional query params: role, search, page, limit, sortBy, sortOrder
router.get('/', verifyToken, async function(req, res) {
  try {
    const {
      role,
      search,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const filter = {};
    if (role) {
      filter.role = role;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { userName: regex },
        { email: regex },
        { phone: regex }
      ];
    }

    const sort = { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort(sort)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .select('-password'),
      User.countDocuments(filter)
    ]);

    // Disable caching to avoid 304 Not Modified for API consumers
    res.set('Cache-Control', 'no-store');

    res.json({
      success: true,
      data: {
        users: items.map((u) => u.toJSON()),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          pages: Math.ceil(total / limitNumber)
        }
      }
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// GET /api/users/:id
router.get('/:id', verifyToken, [param('id').isMongoId()], async function(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { user: user.toJSON() } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching user' });
  }
});

// POST /api/users (manager only)
router.post(
  '/',
  verifyToken,
  authorize('healthcare_manager'),
  [
    body('userName').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').matches(/^\+?[\d\s-()]+$/).withMessage('Valid phone is required'),
    body('dateOfBirth').isISO8601().withMessage('dateOfBirth must be ISO date'),
    body('address.street').notEmpty(),
    body('address.city').notEmpty(),
    body('address.state').notEmpty(),
    body('address.zipCode').notEmpty(),
    body('role').isIn(['patient', 'healthcare_professional', 'hospital_staff', 'healthcare_manager'])
  ],
  async function(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { role, ...base } = req.body;

      // Check duplicates
      const duplicate = await User.findOne({ $or: [{ email: base.email }, { userName: base.userName }] });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'User with this email or username already exists' });
      }

      let userDoc;
      switch (role) {
        case 'patient':
          userDoc = new Patient({ ...base, role: 'patient' });
          break;
        case 'healthcare_professional':
          userDoc = new HealthcareProfessional({ ...base, role: 'healthcare_professional' });
          break;
        case 'hospital_staff':
          userDoc = new HospitalStaff({ ...base, role: 'hospital_staff' });
          break;
        case 'healthcare_manager':
        default:
          userDoc = new User({ ...base, role: 'healthcare_manager' });
      }

      await userDoc.save();
      res.status(201).json({ success: true, message: 'User created successfully', data: { user: userDoc.toJSON() } });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ success: false, message: 'Server error while creating user' });
    }
  }
);

// PUT /api/users/:id (manager only)
router.put(
  '/:id',
  verifyToken,
  authorize('healthcare_manager'),
  [param('id').isMongoId()],
  async function(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const updates = { ...req.body };
      delete updates.password; // password updates not allowed here
      delete updates.role; // role changes restricted for safety

      const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).select('-password');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, message: 'User updated successfully', data: { user: user.toJSON() } });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ success: false, message: 'Server error while updating user' });
    }
  }
);

// DELETE /api/users/:id (manager only)
router.delete(
  '/:id',
  verifyToken,
  authorize('healthcare_manager'),
  [param('id').isMongoId()],
  async function(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ success: false, message: 'Server error while deleting user' });
    }
  }
);

module.exports = router;
