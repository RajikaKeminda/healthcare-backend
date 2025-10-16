const express = require('express');
const { query, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview statistics
router.get('/dashboard', verifyToken, authorize('healthcare_manager', 'hospital_staff'), async (req, res) => {
  try {
    const { hospitalID, dateFrom, dateTo } = req.query;
    
    // Set default date range (last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build filter
    let filter = {};
    if (hospitalID) filter.hospitalID = hospitalID;

    // Patient statistics
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const newPatientsThisMonth = await User.countDocuments({
      role: 'patient',
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    // Appointment statistics
    const appointmentFilter = { ...filter, date: { $gte: startDate, $lte: endDate } };
    const totalAppointments = await Appointment.countDocuments(appointmentFilter);
    const completedAppointments = await Appointment.countDocuments({ ...appointmentFilter, status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ ...appointmentFilter, status: 'cancelled' });
    const noShowAppointments = await Appointment.countDocuments({ ...appointmentFilter, status: 'no_show' });

    // Payment statistics
    const paymentFilter = { ...filter, createdAt: { $gte: startDate, $lte: endDate } };
    const totalRevenue = await Payment.aggregate([
      { $match: { ...paymentFilter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPayments = await Payment.countDocuments({ ...paymentFilter, status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ ...paymentFilter, status: 'pending' });

    // Healthcare professional statistics
    const totalDoctors = await User.countDocuments({ role: 'healthcare_professional' });
    const activeDoctors = await User.countDocuments({ role: 'healthcare_professional', isActive: true });

    // Hospital capacity
    const hospitals = await Hospital.find(filter);
    const totalBeds = hospitals.reduce((sum, hospital) => sum + hospital.capacity.totalBeds, 0);
    const occupiedBeds = hospitals.reduce((sum, hospital) => sum + hospital.capacity.occupiedBeds, 0);

    // Calculate metrics
    const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;
    const bedOccupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
    const averageRevenuePerAppointment = completedAppointments > 0 ? (totalRevenue[0]?.total || 0) / completedAppointments : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalPatients,
          newPatientsThisMonth,
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          noShowAppointments,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalPayments,
          pendingPayments,
          totalDoctors,
          activeDoctors,
          totalBeds,
          occupiedBeds
        },
        metrics: {
          appointmentCompletionRate: Math.round(appointmentCompletionRate * 100) / 100,
          noShowRate: Math.round(noShowRate * 100) / 100,
          bedOccupancyRate: Math.round(bedOccupancyRate * 100) / 100,
          averageRevenuePerAppointment: Math.round(averageRevenuePerAppointment * 100) / 100
        },
        dateRange: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get appointment analytics
router.get('/appointments', verifyToken, authorize('healthcare_manager', 'hospital_staff'), [
  query('dateFrom').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('dateTo').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('hospitalID').optional().isMongoId().withMessage('Invalid hospital ID'),
  query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
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

    const { hospitalID, dateFrom, dateTo, groupBy = 'day' } = req.query;
    
    // Set default date range (last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build filter
    let filter = { date: { $gte: startDate, $lte: endDate } };
    if (hospitalID) filter.hospitalID = hospitalID;

    // Group by period
    let groupFormat;
    switch (groupBy) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
    }

    // Appointment trends
    const appointmentTrends = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$date' }
          },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Appointment by status
    const appointmentsByStatus = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Appointment by type
    const appointmentsByType = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Top doctors by appointments
    const topDoctors = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$doctorID',
          appointmentCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      { $sort: { appointmentCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $project: {
          doctorName: { $arrayElemAt: ['$doctor.userName', 0] },
          specialization: { $arrayElemAt: ['$doctor.specialization', 0] },
          appointmentCount: 1,
          completedCount: 1,
          completionRate: { $multiply: [{ $divide: ['$completedCount', '$appointmentCount'] }, 100] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        trends: appointmentTrends,
        byStatus: appointmentsByStatus,
        byType: appointmentsByType,
        topDoctors,
        dateRange: { startDate, endDate },
        groupBy
      }
    });

  } catch (error) {
    console.error('Appointment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointment analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get financial analytics
router.get('/financial', verifyToken, authorize('healthcare_manager', 'hospital_staff'), [
  query('dateFrom').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('dateTo').optional().isISO8601().withMessage('Date must be in ISO format'),
  query('hospitalID').optional().isMongoId().withMessage('Invalid hospital ID'),
  query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Group by must be day, week, or month')
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

    const { hospitalID, dateFrom, dateTo, groupBy = 'day' } = req.query;
    
    // Set default date range (last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build filter
    let filter = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };
    if (hospitalID) filter.hospitalID = hospitalID;

    // Group by period
    let groupFormat;
    switch (groupBy) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
    }

    // Revenue trends
    const revenueTrends = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$createdAt' }
          },
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$method',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    // Revenue by hospital
    const revenueByHospital = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$hospitalID',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'hospitals',
          localField: '_id',
          foreignField: '_id',
          as: 'hospital'
        }
      },
      {
        $project: {
          hospitalName: { $arrayElemAt: ['$hospital.name', 0] },
          totalRevenue: 1,
          transactionCount: 1
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Payment status summary
    const paymentStatusSummary = await Payment.aggregate([
      { $match: { ...filter, createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Calculate metrics
    const totalRevenue = revenueTrends.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalTransactions = revenueTrends.reduce((sum, item) => sum + item.transactionCount, 0);
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    res.json({
      success: true,
      data: {
        trends: revenueTrends,
        byMethod: revenueByMethod,
        byHospital: revenueByHospital,
        statusSummary: paymentStatusSummary,
        metrics: {
          totalRevenue,
          totalTransactions,
          averageTransactionValue: Math.round(averageTransactionValue * 100) / 100
        },
        dateRange: { startDate, endDate },
        groupBy
      }
    });

  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching financial analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get patient analytics
router.get('/patients', verifyToken, authorize('healthcare_manager', 'hospital_staff'), [
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

    const { dateFrom, dateTo } = req.query;
    
    // Set default date range (last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Patient registration trends
    const registrationTrends = await User.aggregate([
      {
        $match: {
          role: 'patient',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Patient age distribution
    const ageDistribution = await User.aggregate([
      { $match: { role: 'patient' } },
      {
        $project: {
          age: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), '$dateOfBirth'] },
                365.25 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 18, 30, 45, 60, 75, 100],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Patient activity (appointments per patient)
    const patientActivity = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$patientID',
          appointmentCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'patient'
        }
      },
      {
        $project: {
          patientName: { $arrayElemAt: ['$patient.userName', 0] },
          appointmentCount: 1,
          completedCount: 1
        }
      },
      { $sort: { appointmentCount: -1 } },
      { $limit: 10 }
    ]);

    // Total patients
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const newPatientsThisPeriod = await User.countDocuments({
      role: 'patient',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    res.json({
      success: true,
      data: {
        registrationTrends,
        ageDistribution,
        patientActivity,
        summary: {
          totalPatients,
          newPatientsThisPeriod
        },
        dateRange: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Patient analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Export analytics data
router.get('/export', verifyToken, authorize('healthcare_manager', 'hospital_staff'), [
  query('type').isIn(['appointments', 'financial', 'patients']).withMessage('Export type must be appointments, financial, or patients'),
  query('format').isIn(['json', 'csv']).withMessage('Export format must be json or csv'),
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

    const { type, format, dateFrom, dateTo } = req.query;
    
    // Set default date range (last 30 days)
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let data;
    let filename;

    switch (type) {
      case 'appointments':
        data = await Appointment.find({
          date: { $gte: startDate, $lte: endDate }
        }).populate('patientID', 'userName email').populate('doctorID', 'userName specialization');
        filename = `appointments_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
        break;
      case 'financial':
        data = await Payment.find({
          createdAt: { $gte: startDate, $lte: endDate }
        }).populate('patientID', 'userName email').populate('hospitalID', 'name');
        filename = `financial_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
        break;
      case 'patients':
        data = await User.find({
          role: 'patient',
          createdAt: { $gte: startDate, $lte: endDate }
        });
        filename = `patients_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
        break;
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(data);
    } else if (format === 'csv') {
      // Convert to CSV format (simplified)
      const csvData = data.map(item => {
        return Object.values(item.toObject()).join(',');
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
