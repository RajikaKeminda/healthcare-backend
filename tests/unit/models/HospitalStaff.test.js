const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const HospitalStaff = require('../../../models/HospitalStaff');
const User = require('../../../models/User');

describe('HospitalStaff Model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  const baseUserData = {
    dateOfBirth: new Date('1985-05-20'),
    address: {
      street: '456 Staff St',
      city: 'Staff City',
      state: 'Staff State',
      zipCode: '54321',
      country: 'Sri Lanka'
    }
  };

  describe('HospitalStaff Creation', () => {
    it('should create a valid hospital staff with required fields', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: {
          start: '08:00',
          end: '16:00'
        }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff._id).toBeDefined();
      expect(savedStaff.staffID).toBeDefined();
      expect(savedStaff.userName).toBe(staffData.userName);
      expect(savedStaff.email).toBe(staffData.email);
      expect(savedStaff.staffRole).toBe(staffData.staffRole);
      expect(savedStaff.department).toBe(staffData.department);
      expect(savedStaff.employeeID).toBe(staffData.employeeID);
      expect(savedStaff.hireDate).toEqual(staffData.hireDate);
      expect(savedStaff.workingHours.start).toBe(staffData.workingHours.start);
      expect(savedStaff.workingHours.end).toBe(staffData.workingHours.end);
      expect(savedStaff.shift).toBe('morning');
      expect(savedStaff.isActive).toBe(true);
    });

    it('should fail without required fields', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData
        // Missing staffRole, department, employeeID, hireDate, workingHours
      };

      const staff = new HospitalStaff(staffData);
      
      await expect(staff.save()).rejects.toThrow();
    });

    it('should generate unique staffID', async () => {
      const staffData1 = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staffData2 = {
        userName: 'John Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        phone: '+1234567891',
        role: 'hospital_staff',
        dateOfBirth: new Date('1988-08-10'),
        address: {
          street: '789 Reception St',
          city: 'Reception City',
          state: 'Reception State',
          zipCode: '67890',
          country: 'Sri Lanka'
        },
        staffRole: 'receptionist',
        department: 'Reception',
        employeeID: 'EMP002',
        hireDate: new Date('2020-02-15'),
        workingHours: { start: '09:00', end: '17:00' }
      };

      const staff1 = new HospitalStaff(staffData1);
      const staff2 = new HospitalStaff(staffData2);
      
      const saved1 = await staff1.save();
      const saved2 = await staff2.save();

      expect(saved1.staffID).toBeDefined();
      expect(saved2.staffID).toBeDefined();
      expect(saved1.staffID).not.toBe(saved2.staffID);
    });

    it('should validate staffRole enum', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'invalid_role',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staff = new HospitalStaff(staffData);
      
      await expect(staff.save()).rejects.toThrow();
    });

    it('should validate employeeID uniqueness', async () => {
      const staffData1 = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staffData2 = {
        userName: 'John Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        phone: '+1234567891',
        role: 'hospital_staff',
        dateOfBirth: new Date('1988-08-10'),
        address: {
          street: '789 Reception St',
          city: 'Reception City',
          state: 'Reception State',
          zipCode: '67890',
          country: 'Sri Lanka'
        },
        staffRole: 'receptionist',
        department: 'Reception',
        employeeID: 'EMP001', // Same employee ID
        hireDate: new Date('2020-02-15'),
        workingHours: { start: '09:00', end: '17:00' }
      };

      const staff1 = new HospitalStaff(staffData1);
      await staff1.save();

      const staff2 = new HospitalStaff(staffData2);
      
      await expect(staff2.save()).rejects.toThrow();
    });

    it('should validate salary minimum', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        salary: -1000 // Invalid: negative salary
      };

      const staff = new HospitalStaff(staffData);
      
      await expect(staff.save()).rejects.toThrow();
    });

    it('should validate shift enum', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        shift: 'invalid_shift'
      };

      const staff = new HospitalStaff(staffData);
      
      await expect(staff.save()).rejects.toThrow();
    });
  });

  describe('HospitalStaff with Permissions', () => {
    it('should store permissions correctly', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        permissions: ['view_patients', 'edit_patients', 'view_appointments', 'manage_appointments']
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.permissions).toHaveLength(4);
      expect(savedStaff.permissions).toContain('view_patients');
      expect(savedStaff.permissions).toContain('edit_patients');
      expect(savedStaff.permissions).toContain('view_appointments');
      expect(savedStaff.permissions).toContain('manage_appointments');
    });

    it('should validate permission enum', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        permissions: ['invalid_permission']
      };

      const staff = new HospitalStaff(staffData);
      
      await expect(staff.save()).rejects.toThrow();
    });
  });

  describe('HospitalStaff Status Management', () => {
    it('should update isActive status', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.isActive).toBe(true);

      savedStaff.isActive = false;
      const updatedStaff = await savedStaff.save();

      expect(updatedStaff.isActive).toBe(false);
    });

    it('should track hire date correctly', async () => {
      const hireDate = new Date('2020-01-15');
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: hireDate,
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.hireDate).toEqual(hireDate);
    });
  });

  describe('HospitalStaff Working Hours', () => {
    it('should validate working hours format', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: {
          start: '08:00',
          end: '16:00'
        }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.workingHours.start).toBe('08:00');
      expect(savedStaff.workingHours.end).toBe('16:00');
    });

    it('should handle different shift types', async () => {
      const shifts = ['morning', 'afternoon', 'night', 'flexible'];
      
      for (const shift of shifts) {
        const staffData = {
          userName: `Staff ${shift}`,
          email: `staff.${shift}@hospital.com`,
          password: 'password123',
          phone: '+1234567890',
          role: 'hospital_staff',
          ...baseUserData,
          staffRole: 'nurse',
          department: 'Emergency',
          employeeID: `EMP${shift}`,
          hireDate: new Date('2020-01-15'),
          workingHours: { start: '08:00', end: '16:00' },
          shift: shift
        };

        const staff = new HospitalStaff(staffData);
        const savedStaff = await staff.save();

        expect(savedStaff.shift).toBe(shift);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long department names', async () => {
      const longDepartment = 'a'.repeat(100);
      
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: longDepartment,
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.department).toBe(longDepartment);
    });

    it('should handle many permissions', async () => {
      const allPermissions = [
        'view_patients',
        'edit_patients',
        'view_appointments',
        'manage_appointments',
        'view_payments',
        'process_payments',
        'view_reports',
        'manage_inventory',
        'system_admin'
      ];
      
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'administrator',
        department: 'Administration',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        permissions: allPermissions
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.permissions).toHaveLength(9);
      expect(savedStaff.permissions).toEqual(expect.arrayContaining(allPermissions));
    });

    it('should handle boundary salary values', async () => {
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: new Date('2020-01-15'),
        workingHours: { start: '08:00', end: '16:00' },
        salary: 0 // Minimum allowed
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.salary).toBe(0);
    });

    it('should handle future hire dates', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      const staffData = {
        userName: 'Jane Smith',
        email: 'jane.smith@hospital.com',
        password: 'password123',
        phone: '+1234567890',
        role: 'hospital_staff',
        ...baseUserData,
        staffRole: 'nurse',
        department: 'Emergency',
        employeeID: 'EMP001',
        hireDate: futureDate,
        workingHours: { start: '08:00', end: '16:00' }
      };

      const staff = new HospitalStaff(staffData);
      const savedStaff = await staff.save();

      expect(savedStaff.hireDate).toEqual(futureDate);
    });
  });

  describe('All Staff Roles', () => {
    it('should validate all valid staff roles', async () => {
      const validRoles = [
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
      ];

      for (let i = 0; i < validRoles.length; i++) {
        const staffData = {
          userName: `Staff ${i}`,
          email: `staff${i}@hospital.com`,
          password: 'password123',
          phone: '+1234567890',
          role: 'hospital_staff',
          ...baseUserData,
          staffRole: validRoles[i],
          department: 'Test Department',
          employeeID: `EMP${i}`,
          hireDate: new Date('2020-01-15'),
          workingHours: { start: '08:00', end: '16:00' }
        };

        const staff = new HospitalStaff(staffData);
        const savedStaff = await staff.save();

        expect(savedStaff.staffRole).toBe(validRoles[i]);
      }
    });
  });
});