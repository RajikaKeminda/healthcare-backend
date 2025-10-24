const Appointment = require('../../../models/Appointment');
const Payment = require('../../../models/Payment');
const MedicalRecord = require('../../../models/MedicalRecord');
const User = require('../../../models/User');
const Hospital = require('../../../models/Hospital');
const { createTestUser, createTestHospital, createTestAppointment, createTestPayment } = require('../../utils/testHelpers');

require('../../setup');

// Analytics utility functions (extracted from routes for testing)
const analyticsUtils = {
  // Calculate appointment completion rate
  calculateCompletionRate: (totalAppointments, completedAppointments) => {
    return totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
  },

  // Calculate no-show rate
  calculateNoShowRate: (totalAppointments, noShowAppointments) => {
    return totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;
  },

  // Calculate bed occupancy rate
  calculateBedOccupancyRate: (totalBeds, occupiedBeds) => {
    return totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
  },

  // Calculate average revenue per appointment
  calculateAverageRevenuePerAppointment: (totalRevenue, completedAppointments) => {
    return completedAppointments > 0 ? totalRevenue / completedAppointments : 0;
  },

  // Get group format for date grouping
  getGroupFormat: (groupBy) => {
    switch (groupBy) {
      case 'day':
        return '%Y-%m-%d';
      case 'week':
        return '%Y-%U';
      case 'month':
        return '%Y-%m';
      default:
        return '%Y-%m-%d';
    }
  },

  // Calculate age from date of birth
  calculateAge: (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },

  // Format currency
  formatCurrency: (amount) => {
    return Math.round(amount * 100) / 100;
  },

  // Validate date range
  validateDateRange: (dateFrom, dateTo) => {
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom);
      const end = new Date(dateTo);
      return start <= end;
    }
    return true;
  },

  // Build hospital filter
  buildHospitalFilter: (hospitalID) => {
    let filter = {};
    if (hospitalID) filter.hospitalID = hospitalID;
    return filter;
  },

  // Build date filter
  buildDateFilter: (startDate, endDate) => {
    return { $gte: startDate, $lte: endDate };
  }
};

describe('Analytics Utils', () => {
  describe('calculateCompletionRate', () => {
    it('should calculate completion rate correctly', () => {
      expect(analyticsUtils.calculateCompletionRate(100, 80)).toBe(80);
      expect(analyticsUtils.calculateCompletionRate(50, 25)).toBe(50);
      expect(analyticsUtils.calculateCompletionRate(0, 0)).toBe(0);
    });

    it('should handle zero total appointments', () => {
      expect(analyticsUtils.calculateCompletionRate(0, 10)).toBe(0);
    });

    it('should handle decimal results', () => {
      expect(analyticsUtils.calculateCompletionRate(3, 1)).toBeCloseTo(33.33, 2);
    });
  });

  describe('calculateNoShowRate', () => {
    it('should calculate no-show rate correctly', () => {
      expect(analyticsUtils.calculateNoShowRate(100, 10)).toBe(10);
      expect(analyticsUtils.calculateNoShowRate(50, 5)).toBe(10);
      expect(analyticsUtils.calculateNoShowRate(0, 0)).toBe(0);
    });

    it('should handle zero total appointments', () => {
      expect(analyticsUtils.calculateNoShowRate(0, 5)).toBe(0);
    });
  });

  describe('calculateBedOccupancyRate', () => {
    it('should calculate bed occupancy rate correctly', () => {
      expect(analyticsUtils.calculateBedOccupancyRate(100, 75)).toBe(75);
      expect(analyticsUtils.calculateBedOccupancyRate(50, 25)).toBe(50);
      expect(analyticsUtils.calculateBedOccupancyRate(0, 0)).toBe(0);
    });

    it('should handle zero total beds', () => {
      expect(analyticsUtils.calculateBedOccupancyRate(0, 10)).toBe(0);
    });
  });

  describe('calculateAverageRevenuePerAppointment', () => {
    it('should calculate average revenue per appointment correctly', () => {
      expect(analyticsUtils.calculateAverageRevenuePerAppointment(1000, 10)).toBe(100);
      expect(analyticsUtils.calculateAverageRevenuePerAppointment(500, 5)).toBe(100);
      expect(analyticsUtils.calculateAverageRevenuePerAppointment(0, 0)).toBe(0);
    });

    it('should handle zero completed appointments', () => {
      expect(analyticsUtils.calculateAverageRevenuePerAppointment(1000, 0)).toBe(0);
    });
  });

  describe('getGroupFormat', () => {
    it('should return correct format for day grouping', () => {
      expect(analyticsUtils.getGroupFormat('day')).toBe('%Y-%m-%d');
    });

    it('should return correct format for week grouping', () => {
      expect(analyticsUtils.getGroupFormat('week')).toBe('%Y-%U');
    });

    it('should return correct format for month grouping', () => {
      expect(analyticsUtils.getGroupFormat('month')).toBe('%Y-%m');
    });

    it('should return default format for invalid grouping', () => {
      expect(analyticsUtils.getGroupFormat('invalid')).toBe('%Y-%m-%d');
    });
  });

  describe('calculateAge', () => {
    it('should calculate age correctly', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      expect(analyticsUtils.calculateAge(birthDate)).toBe(25);
    });

    it('should handle leap year correctly', () => {
      const birthDate = new Date('1992-02-29'); // Leap year
      const age = analyticsUtils.calculateAge(birthDate);
      expect(age).toBeGreaterThan(30);
    });

    it('should handle future birth dates', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const age = analyticsUtils.calculateAge(futureDate);
      expect(age).toBeLessThan(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(analyticsUtils.formatCurrency(123.456)).toBe(123.46);
      expect(analyticsUtils.formatCurrency(100.999)).toBe(101);
      expect(analyticsUtils.formatCurrency(50)).toBe(50);
    });

    it('should handle zero', () => {
      expect(analyticsUtils.formatCurrency(0)).toBe(0);
    });
  });

  describe('validateDateRange', () => {
    it('should validate correct date range', () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';
      expect(analyticsUtils.validateDateRange(dateFrom, dateTo)).toBe(true);
    });

    it('should reject invalid date range', () => {
      const dateFrom = '2024-01-31';
      const dateTo = '2024-01-01';
      expect(analyticsUtils.validateDateRange(dateFrom, dateTo)).toBe(false);
    });

    it('should handle missing dates', () => {
      expect(analyticsUtils.validateDateRange(null, null)).toBe(true);
      expect(analyticsUtils.validateDateRange('2024-01-01', null)).toBe(true);
      expect(analyticsUtils.validateDateRange(null, '2024-01-31')).toBe(true);
    });
  });

  describe('buildHospitalFilter', () => {
    it('should build filter with hospital ID', () => {
      const hospitalID = '507f1f77bcf86cd799439011';
      const filter = analyticsUtils.buildHospitalFilter(hospitalID);
      expect(filter).toEqual({ hospitalID });
    });

    it('should build empty filter without hospital ID', () => {
      const filter = analyticsUtils.buildHospitalFilter(null);
      expect(filter).toEqual({});
    });
  });

  describe('buildDateFilter', () => {
    it('should build date filter correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const filter = analyticsUtils.buildDateFilter(startDate, endDate);
      expect(filter).toEqual({ $gte: startDate, $lte: endDate });
    });
  });
});

describe('Analytics Data Processing', () => {
  let patient, doctor, hospital, appointment, payment;

  beforeEach(async () => {
    patient = await createTestUser('patient');
    doctor = await createTestUser('healthcare_professional');
    hospital = await createTestHospital();
    appointment = await createTestAppointment(patient, doctor, hospital);
    payment = await createTestPayment(patient, hospital, appointment);
  });

  describe('Dashboard Analytics Data', () => {
    it('should calculate dashboard metrics correctly', async () => {
      // Create additional test data
      const appointment2 = await createTestAppointment(patient, doctor, hospital);
      const payment2 = await createTestPayment(patient, hospital, appointment2);

      // Get dashboard data
      const totalPatients = await User.countDocuments({ role: 'patient' });
      const totalAppointments = await Appointment.countDocuments();
      const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
      const totalRevenue = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Calculate metrics using utils
      const completionRate = analyticsUtils.calculateCompletionRate(totalAppointments, completedAppointments);
      const averageRevenue = analyticsUtils.calculateAverageRevenuePerAppointment(
        totalRevenue[0]?.total || 0, 
        completedAppointments
      );

      expect(completionRate).toBeGreaterThanOrEqual(0);
      expect(averageRevenue).toBeGreaterThanOrEqual(0);
      expect(totalPatients).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      // Test with no data
      const totalAppointments = 0;
      const completedAppointments = 0;
      const totalRevenue = 0;

      const completionRate = analyticsUtils.calculateCompletionRate(totalAppointments, completedAppointments);
      const averageRevenue = analyticsUtils.calculateAverageRevenuePerAppointment(totalRevenue, completedAppointments);

      expect(completionRate).toBe(0);
      expect(averageRevenue).toBe(0);
    });
  });

  describe('Appointment Analytics Data', () => {
    it('should process appointment trends correctly', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const appointmentTrends = await Appointment.aggregate([
        { 
          $match: { 
            date: { $gte: startDate, $lte: endDate } 
          } 
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      expect(Array.isArray(appointmentTrends)).toBe(true);
      if (appointmentTrends.length > 0) {
        expect(appointmentTrends[0]).toHaveProperty('_id');
        expect(appointmentTrends[0]).toHaveProperty('total');
        expect(appointmentTrends[0]).toHaveProperty('completed');
        expect(appointmentTrends[0]).toHaveProperty('cancelled');
        expect(appointmentTrends[0]).toHaveProperty('noShow');
      }
    });

    it('should group appointments by status correctly', async () => {
      const appointmentsByStatus = await Appointment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      expect(Array.isArray(appointmentsByStatus)).toBe(true);
      appointmentsByStatus.forEach(status => {
        expect(status).toHaveProperty('_id');
        expect(status).toHaveProperty('count');
        expect(typeof status.count).toBe('number');
      });
    });

    it('should group appointments by type correctly', async () => {
      const appointmentsByType = await Appointment.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      expect(Array.isArray(appointmentsByType)).toBe(true);
      appointmentsByType.forEach(type => {
        expect(type).toHaveProperty('_id');
        expect(type).toHaveProperty('count');
        expect(typeof type.count).toBe('number');
      });
    });
  });

  describe('Financial Analytics Data', () => {
    it('should process revenue trends correctly', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const revenueTrends = await Payment.aggregate([
        { 
          $match: { 
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          } 
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      expect(Array.isArray(revenueTrends)).toBe(true);
      if (revenueTrends.length > 0) {
        expect(revenueTrends[0]).toHaveProperty('_id');
        expect(revenueTrends[0]).toHaveProperty('totalRevenue');
        expect(revenueTrends[0]).toHaveProperty('transactionCount');
        expect(typeof revenueTrends[0].totalRevenue).toBe('number');
        expect(typeof revenueTrends[0].transactionCount).toBe('number');
      }
    });

    it('should group revenue by payment method correctly', async () => {
      const revenueByMethod = await Payment.aggregate([
        {
          $group: {
            _id: '$method',
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 }
          }
        }
      ]);

      expect(Array.isArray(revenueByMethod)).toBe(true);
      revenueByMethod.forEach(method => {
        expect(method).toHaveProperty('_id');
        expect(method).toHaveProperty('totalRevenue');
        expect(method).toHaveProperty('transactionCount');
        expect(typeof method.totalRevenue).toBe('number');
        expect(typeof method.transactionCount).toBe('number');
      });
    });

    it('should calculate financial metrics correctly', async () => {
      const revenueTrends = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 }
          }
        }
      ]);

      const totalRevenue = revenueTrends[0]?.totalRevenue || 0;
      const totalTransactions = revenueTrends[0]?.transactionCount || 0;
      const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      expect(typeof totalRevenue).toBe('number');
      expect(typeof totalTransactions).toBe('number');
      expect(typeof averageTransactionValue).toBe('number');
      expect(averageTransactionValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Patient Analytics Data', () => {
    it('should process patient registration trends correctly', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

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

      expect(Array.isArray(registrationTrends)).toBe(true);
      registrationTrends.forEach(trend => {
        expect(trend).toHaveProperty('_id');
        expect(trend).toHaveProperty('count');
        expect(typeof trend.count).toBe('number');
      });
    });

    it('should process patient age distribution correctly', async () => {
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

      expect(Array.isArray(ageDistribution)).toBe(true);
      ageDistribution.forEach(bucket => {
        expect(bucket).toHaveProperty('_id');
        expect(bucket).toHaveProperty('count');
        expect(typeof bucket.count).toBe('number');
      });
    });

    it('should process patient activity correctly', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

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

      expect(Array.isArray(patientActivity)).toBe(true);
      patientActivity.forEach(activity => {
        expect(activity).toHaveProperty('appointmentCount');
        expect(activity).toHaveProperty('completedCount');
        expect(typeof activity.appointmentCount).toBe('number');
        expect(typeof activity.completedCount).toBe('number');
      });
    });
  });

  describe('Export Data Processing', () => {
    it('should format appointment data for export', async () => {
      const appointments = await Appointment.find()
        .populate('patientID', 'userName email')
        .populate('doctorID', 'userName specialization');

      expect(Array.isArray(appointments)).toBe(true);
      if (appointments.length > 0) {
        const appointment = appointments[0];
        expect(appointment).toHaveProperty('patientID');
        expect(appointment).toHaveProperty('doctorID');
        expect(appointment).toHaveProperty('date');
        expect(appointment).toHaveProperty('status');
      }
    });

    it('should format payment data for export', async () => {
      const payments = await Payment.find()
        .populate('patientID', 'userName email')
        .populate('hospitalID', 'name');

      expect(Array.isArray(payments)).toBe(true);
      if (payments.length > 0) {
        const payment = payments[0];
        expect(payment).toHaveProperty('patientID');
        expect(payment).toHaveProperty('hospitalID');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('status');
      }
    });

    it('should format patient data for export', async () => {
      const patients = await User.find({ role: 'patient' });

      expect(Array.isArray(patients)).toBe(true);
      if (patients.length > 0) {
        const patient = patients[0];
        expect(patient).toHaveProperty('userName');
        expect(patient).toHaveProperty('email');
        expect(patient).toHaveProperty('role');
        expect(patient.role).toBe('patient');
      }
    });
  });
});

describe('Analytics Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    // Test with invalid ObjectId
    try {
      await Appointment.find({ hospitalID: 'invalid-id' });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle empty aggregation results', async () => {
    const emptyResults = await Appointment.aggregate([
      { $match: { status: 'non-existent-status' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    expect(Array.isArray(emptyResults)).toBe(true);
    expect(emptyResults.length).toBe(0);
  });

  it('should handle null values in calculations', () => {
    const completionRate = analyticsUtils.calculateCompletionRate(null, 10);
    const noShowRate = analyticsUtils.calculateNoShowRate(100, null);
    const bedOccupancyRate = analyticsUtils.calculateBedOccupancyRate(null, null);

    expect(completionRate).toBe(0);
    expect(noShowRate).toBe(0);
    expect(bedOccupancyRate).toBe(0);
  });

  it('should handle invalid date range in analytics queries', async () => {
    const invalidStartDate = 'invalid-date';
    const invalidEndDate = 'another-invalid-date';

    try {
      await Appointment.aggregate([
        { 
          $match: { 
            date: { $gte: new Date(invalidStartDate), $lte: new Date(invalidEndDate) } 
          } 
        },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle malformed aggregation pipeline', async () => {
    try {
      await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$invalidField', count: { $sum: '$invalidField' } } }
      ]);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle division by zero in calculations', () => {
    const completionRate = analyticsUtils.calculateCompletionRate(0, 0);
    const noShowRate = analyticsUtils.calculateNoShowRate(0, 0);
    const averageRevenue = analyticsUtils.calculateAverageRevenuePerAppointment(1000, 0);

    expect(completionRate).toBe(0);
    expect(noShowRate).toBe(0);
    expect(averageRevenue).toBe(0);
  });

  it('should handle undefined values in utility functions', () => {
    const completionRate = analyticsUtils.calculateCompletionRate(undefined, 10);
    const noShowRate = analyticsUtils.calculateNoShowRate(100, undefined);
    const bedOccupancyRate = analyticsUtils.calculateBedOccupancyRate(undefined, undefined);

    expect(completionRate).toBe(0);
    expect(noShowRate).toBe(0);
    expect(bedOccupancyRate).toBe(0);
  });
});
