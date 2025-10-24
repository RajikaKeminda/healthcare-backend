const cron = require('node-cron');
const scheduler = require('../../../services/scheduler');

// Mock the notification service
jest.mock('../../../services/notificationService', () => ({
  sendDailyAppointmentReminders: jest.fn()
}));

const { sendDailyAppointmentReminders } = require('../../../services/notificationService');

describe('Scheduler Service', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('scheduleDailyReminders', () => {
    it('should schedule daily reminders at 6 PM', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      
      scheduler.scheduleDailyReminders();
      
      expect(scheduleSpy).toHaveBeenCalledWith(
        '0 18 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: "Asia/Colombo"
        }
      );
      
      scheduleSpy.mockRestore();
    });

    it('should execute daily reminders callback successfully', async () => {
      const mockResult = { success: true, totalAppointments: 5 };
      sendDailyAppointmentReminders.mockResolvedValue(mockResult);

      const scheduleSpy = jest.spyOn(cron, 'schedule');
      scheduler.scheduleDailyReminders();
      
      // Get the callback function that was passed to cron.schedule
      const callback = scheduleSpy.mock.calls[0][1];
      
      // Execute the callback
      await callback();
      
      expect(sendDailyAppointmentReminders).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Running daily appointment reminders...');
      expect(consoleSpy).toHaveBeenCalledWith('Daily reminders result:', mockResult);
      
      scheduleSpy.mockRestore();
    });

    it('should handle errors in daily reminders callback', async () => {
      const mockError = new Error('Database connection failed');
      sendDailyAppointmentReminders.mockRejectedValue(mockError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      
      scheduler.scheduleDailyReminders();
      
      // Get the callback function that was passed to cron.schedule
      const callback = scheduleSpy.mock.calls[0][1];
      
      // Execute the callback
      await callback();
      
      expect(sendDailyAppointmentReminders).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error running daily reminders:', mockError);
      
      scheduleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('scheduleWeeklyReports', () => {
    it('should schedule weekly reports every Monday at 9 AM', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      
      scheduler.scheduleWeeklyReports();
      
      expect(scheduleSpy).toHaveBeenCalledWith(
        '0 9 * * 1',
        expect.any(Function),
        {
          scheduled: true,
          timezone: "Asia/Colombo"
        }
      );
      
      scheduleSpy.mockRestore();
    });

    it('should execute weekly reports callback', async () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      scheduler.scheduleWeeklyReports();
      
      // Get the callback function that was passed to cron.schedule
      const callback = scheduleSpy.mock.calls[0][1];
      
      // Execute the callback
      await callback();
      
      expect(consoleSpy).toHaveBeenCalledWith('Generating weekly reports...');
      expect(consoleSpy).toHaveBeenCalledWith('Weekly reports would be generated here');
      
      scheduleSpy.mockRestore();
    });
  });

  describe('scheduleMonthlyCleanup', () => {
    it('should schedule monthly cleanup on first day of month at 2 AM', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      
      scheduler.scheduleMonthlyCleanup();
      
      expect(scheduleSpy).toHaveBeenCalledWith(
        '0 2 1 * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: "Asia/Colombo"
        }
      );
      
      scheduleSpy.mockRestore();
    });

    it('should execute monthly cleanup callback', async () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule');
      scheduler.scheduleMonthlyCleanup();
      
      // Get the callback function that was passed to cron.schedule
      const callback = scheduleSpy.mock.calls[0][1];
      
      // Execute the callback
      await callback();
      
      expect(consoleSpy).toHaveBeenCalledWith('Running monthly cleanup...');
      expect(consoleSpy).toHaveBeenCalledWith('Monthly cleanup would run here');
      
      scheduleSpy.mockRestore();
    });
  });

  describe('initializeScheduler', () => {
    it('should initialize all scheduled tasks', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation();
      
      scheduler.initializeScheduler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Initializing scheduler...');
      expect(consoleSpy).toHaveBeenCalledWith('Scheduler initialized successfully');
      
      // Should call schedule for all three tasks
      expect(scheduleSpy).toHaveBeenCalledTimes(3);
      
      scheduleSpy.mockRestore();
    });

    it('should log initialization messages', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation();
      
      scheduler.initializeScheduler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Initializing scheduler...');
      expect(consoleSpy).toHaveBeenCalledWith('Scheduler initialized successfully');
      
      scheduleSpy.mockRestore();
    });
  });

  describe('Cron Schedule Validation', () => {
    it('should use correct cron expressions', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation();
      
      // Test daily reminders
      scheduler.scheduleDailyReminders();
      expect(scheduleSpy).toHaveBeenCalledWith('0 18 * * *', expect.any(Function), expect.any(Object));
      
      // Test weekly reports
      scheduler.scheduleWeeklyReports();
      expect(scheduleSpy).toHaveBeenCalledWith('0 9 * * 1', expect.any(Function), expect.any(Object));
      
      // Test monthly cleanup
      scheduler.scheduleMonthlyCleanup();
      expect(scheduleSpy).toHaveBeenCalledWith('0 2 1 * *', expect.any(Function), expect.any(Object));
      
      scheduleSpy.mockRestore();
    });

    it('should use Asia/Colombo timezone for all schedules', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation();
      
      scheduler.scheduleDailyReminders();
      scheduler.scheduleWeeklyReports();
      scheduler.scheduleMonthlyCleanup();
      
      // Check that all schedules use Asia/Colombo timezone
      scheduleSpy.mock.calls.forEach(call => {
        expect(call[2].timezone).toBe('Asia/Colombo');
        expect(call[2].scheduled).toBe(true);
      });
      
      scheduleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle cron schedule errors gracefully', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation(() => {
        throw new Error('Cron schedule failed');
      });

      expect(() => {
        scheduler.scheduleDailyReminders();
      }).toThrow('Cron schedule failed');

      scheduleSpy.mockRestore();
    });

    it('should handle initialization errors', () => {
      const scheduleSpy = jest.spyOn(cron, 'schedule').mockImplementation(() => {
        throw new Error('Schedule initialization failed');
      });

      expect(() => {
        scheduler.initializeScheduler();
      }).toThrow('Schedule initialization failed');

      scheduleSpy.mockRestore();
    });
  });

  describe('Module Exports', () => {
    it('should export all required functions', () => {
      expect(scheduler).toHaveProperty('initializeScheduler');
      expect(scheduler).toHaveProperty('scheduleDailyReminders');
      expect(scheduler).toHaveProperty('scheduleWeeklyReports');
      expect(scheduler).toHaveProperty('scheduleMonthlyCleanup');
    });

    it('should export functions as callable', () => {
      expect(typeof scheduler.initializeScheduler).toBe('function');
      expect(typeof scheduler.scheduleDailyReminders).toBe('function');
      expect(typeof scheduler.scheduleWeeklyReports).toBe('function');
      expect(typeof scheduler.scheduleMonthlyCleanup).toBe('function');
    });
  });
});
