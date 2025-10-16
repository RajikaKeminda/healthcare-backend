const cron = require('node-cron');
const { sendDailyAppointmentReminders } = require('./notificationService');

// Schedule daily appointment reminders at 6 PM
const scheduleDailyReminders = () => {
  cron.schedule('0 18 * * *', async () => {
    console.log('Running daily appointment reminders...');
    try {
      const result = await sendDailyAppointmentReminders();
      console.log('Daily reminders result:', result);
    } catch (error) {
      console.error('Error running daily reminders:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });
};

// Schedule weekly report generation (every Monday at 9 AM)
const scheduleWeeklyReports = () => {
  cron.schedule('0 9 * * 1', async () => {
    console.log('Generating weekly reports...');
    // This would typically generate and send weekly reports
    // For now, we'll just log it
    console.log('Weekly reports would be generated here');
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });
};

// Schedule monthly cleanup (first day of every month at 2 AM)
const scheduleMonthlyCleanup = () => {
  cron.schedule('0 2 1 * *', async () => {
    console.log('Running monthly cleanup...');
    // This would typically clean up old logs, temporary files, etc.
    // For now, we'll just log it
    console.log('Monthly cleanup would run here');
  }, {
    scheduled: true,
    timezone: "Asia/Colombo"
  });
};

// Initialize all scheduled tasks
const initializeScheduler = () => {
  console.log('Initializing scheduler...');
  scheduleDailyReminders();
  scheduleWeeklyReports();
  scheduleMonthlyCleanup();
  console.log('Scheduler initialized successfully');
};

module.exports = {
  initializeScheduler,
  scheduleDailyReminders,
  scheduleWeeklyReports,
  scheduleMonthlyCleanup
};
