const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../../app');
const User = require('../../../models/User');
const Patient = require('../../../models/Patient');
const HealthcareProfessional = require('../../../models/HealthcareProfessional');
const HospitalStaff = require('../../../models/HospitalStaff');
const { createTestUser, createTestToken } = require('../../utils/testHelpers');

describe('Users Routes', () => {
  let mongoServer;
  let managerToken;
  let staffToken;
  let patientToken;
  let doctorToken;
  let manager;
  let staff;
  let patient;
  let doctor;

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
    // Clear all collections
    await User.deleteMany({});

    // Create test users
    manager = await createTestUser({
      userName: 'Manager',
      email: 'manager@test.com',
      password: 'password123',
      phone: '+1234567890',
      role: 'healthcare_manager'
    });

    staff = await createTestUser({
      userName: 'Staff',
      email: 'staff@test.com',
      password: 'password123',
      phone: '+1234567891',
      role: 'hospital_staff',
      staffRole: 'nurse',
      department: 'Emergency',
      employeeID: 'EMP001',
      hireDate: new Date('2020-01-15'),
      workingHours: { start: '08:00', end: '16:00' }
    });

    patient = await createTestUser({
      userName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      phone: '+1234567892',
      role: 'patient',
      bloodType: 'A+',
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567893'
      }
    });

    doctor = await createTestUser({
      userName: 'Doctor',
      email: 'doctor@test.com',
      password: 'password123',
      phone: '+1234567894',
      role: 'healthcare_professional',
      specialization: 'Cardiology',
      licenseNumber: 'LIC123456',
      department: 'Cardiology',
      consultationFee: 150
    });

    // Create additional test users for comprehensive testing
    await createTestUser({
      userName: 'Patient2',
      email: 'patient2@test.com',
      password: 'password123',
      phone: '+1234567895',
      role: 'patient',
      bloodType: 'B+',
      emergencyContact: {
        name: 'Emergency Contact 2',
        relationship: 'Parent',
        phone: '+1234567896'
      }
    });

    await createTestUser({
      userName: 'Doctor2',
      email: 'doctor2@test.com',
      password: 'password123',
      phone: '+1234567897',
      role: 'healthcare_professional',
      specialization: 'Neurology',
      licenseNumber: 'LIC123457',
      department: 'Neurology',
      consultationFee: 200
    });

    await createTestUser({
      userName: 'Staff2',
      email: 'staff2@test.com',
      password: 'password123',
      phone: '+1234567898',
      role: 'hospital_staff',
      staffRole: 'receptionist',
      department: 'Reception',
      employeeID: 'EMP002',
      hireDate: new Date('2020-02-15'),
      workingHours: { start: '09:00', end: '17:00' }
    });

    // Create tokens
    managerToken = createTestToken(manager);
    staffToken = createTestToken(staff);
    patientToken = createTestToken(patient);
    doctorToken = createTestToken(doctor);
  });

  describe('GET /api/users', () => {
    it('should get all users for manager', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.users[0].password).toBeUndefined(); // Password should be excluded
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users?role=patient')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.every(user => user.role === 'patient')).toBe(true);
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users?search=Patient')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/users?search=patient@test.com')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should search users by phone', async () => {
      const response = await request(app)
        .get('/api/users?search=+1234567892')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/users?page=1&limit=2')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should sort users by creation date', async () => {
      const response = await request(app)
        .get('/api/users?sortBy=createdAt&sortOrder=desc')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
    });

    it('should sort users by name', async () => {
      const response = await request(app)
        .get('/api/users?sortBy=userName&sortOrder=asc')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
    });

    it('should handle invalid page numbers', async () => {
      const response = await request(app)
        .get('/api/users?page=0')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1); // Should default to 1
    });

    it('should handle invalid limit numbers', async () => {
      const response = await request(app)
        .get('/api/users?limit=300')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.limit).toBeLessThanOrEqual(200); // Should cap at 200
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFind = User.find;
      User.find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      User.find = originalFind;
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by ID for manager', async () => {
      const response = await request(app)
        .get(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user._id).toBe(patient._id.toString());
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should get own profile for any authenticated user', async () => {
      const response = await request(app)
        .get(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user._id).toBe(patient._id.toString());
    });

    it('should fail with invalid user ID', async () => {
      const response = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/api/users/invalid-id')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized access to other users', async () => {
      const response = await request(app)
        .get(`/api/users/${doctor._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/users/${patient._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFindById = User.findById;
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      User.findById = originalFindById;
    });
  });

  describe('POST /api/users', () => {
    it('should create patient user', async () => {
      const userData = {
        userName: 'New Patient',
        email: 'newpatient@test.com',
        password: 'password123',
        phone: '+1234567899',
        role: 'patient',
        bloodType: 'O+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567800'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userName).toBe(userData.userName);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should create healthcare professional user', async () => {
      const userData = {
        userName: 'New Doctor',
        email: 'newdoctor@test.com',
        password: 'password123',
        phone: '+1234567801',
        role: 'healthcare_professional',
        specialization: 'Pediatrics',
        licenseNumber: 'LIC123458',
        department: 'Pediatrics',
        consultationFee: 180
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.specialization).toBe(userData.specialization);
      expect(response.body.data.user.licenseNumber).toBe(userData.licenseNumber);
    });

    it('should create hospital staff user', async () => {
      const userData = {
        userName: 'New Staff',
        email: 'newstaff@test.com',
        password: 'password123',
        phone: '+1234567802',
        role: 'hospital_staff',
        staffRole: 'lab_technician',
        department: 'Laboratory',
        employeeID: 'EMP003',
        hireDate: new Date('2020-03-15'),
        workingHours: { start: '08:00', end: '16:00' }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.staffRole).toBe(userData.staffRole);
      expect(response.body.data.user.employeeID).toBe(userData.employeeID);
    });

    it('should fail without required fields', async () => {
      const userData = {
        userName: 'Incomplete User',
        email: 'incomplete@test.com'
        // Missing password, phone, role
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        userName: 'Invalid Email',
        email: 'invalid-email',
        password: 'password123',
        phone: '+1234567803',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567804'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        userName: 'Duplicate Email',
        email: 'patient@test.com', // Already exists
        password: 'password123',
        phone: '+1234567805',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567806'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid role', async () => {
      const userData = {
        userName: 'Invalid Role',
        email: 'invalidrole@test.com',
        password: 'password123',
        phone: '+1234567807',
        role: 'invalid_role'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const userData = {
        userName: 'Unauthorized User',
        email: 'unauthorized@test.com',
        password: 'password123',
        phone: '+1234567808',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567809'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${patientToken}`])
        .send(userData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const userData = {
        userName: 'No Auth User',
        email: 'noauth@test.com',
        password: 'password123',
        phone: '+1234567810',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567811'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalCreate = User.create;
      User.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const userData = {
        userName: 'Error User',
        email: 'error@test.com',
        password: 'password123',
        phone: '+1234567812',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567813'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(500);

      expect(response.body.success).toBe(false);

      User.create = originalCreate;
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user profile', async () => {
      const updateData = {
        userName: 'Updated Patient',
        phone: '+1234567814'
      };

      const response = await request(app)
        .put(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.userName).toBe(updateData.userName);
      expect(response.body.data.user.phone).toBe(updateData.phone);
    });

    it('should update own profile', async () => {
      const updateData = {
        userName: 'Updated Self',
        phone: '+1234567815'
      };

      const response = await request(app)
        .put(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.userName).toBe(updateData.userName);
    });

    it('should fail with invalid user ID', async () => {
      const updateData = {
        userName: 'Updated User'
      };

      const response = await request(app)
        .put('/api/users/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized access to other users', async () => {
      const updateData = {
        userName: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/users/${doctor._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const updateData = {
        userName: 'No Auth Update'
      };

      const response = await request(app)
        .put(`/api/users/${patient._id}`)
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFindByIdAndUpdate = User.findByIdAndUpdate;
      User.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      const updateData = {
        userName: 'Error Update'
      };

      const response = await request(app)
        .put(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updateData)
        .expect(500);

      expect(response.body.success).toBe(false);

      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user as manager', async () => {
      // Create a user to delete
      const userToDelete = await createTestUser({
        userName: 'To Delete',
        email: 'todelete@test.com',
        password: 'password123',
        phone: '+1234567816',
        role: 'patient',
        bloodType: 'A+',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '+1234567817'
        }
      });

      const response = await request(app)
        .delete(`/api/users/${userToDelete._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app)
        .delete(`/api/users/${manager._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('delete yourself');
    });

    it('should fail with invalid user ID', async () => {
      const response = await request(app)
        .delete('/api/users/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .delete(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .delete(`/api/users/${patient._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle server errors gracefully', async () => {
      const originalFindByIdAndDelete = User.findByIdAndDelete;
      User.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/users/${patient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);

      User.findByIdAndDelete = originalFindByIdAndDelete;
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long search queries', async () => {
      const longSearch = 'a'.repeat(1000);
      
      const response = await request(app)
        .get(`/api/users?search=${longSearch}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle special characters in search', async () => {
      const response = await request(app)
        .get('/api/users?search=@#$%^&*()')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle concurrent user creation', async () => {
      const userPromises = Array.from({ length: 5 }, (_, i) => {
        const userData = {
          userName: `Concurrent User ${i}`,
          email: `concurrent${i}@test.com`,
          password: 'password123',
          phone: `+12345678${i.toString().padStart(2, '0')}`,
          role: 'patient',
          bloodType: 'A+',
          emergencyContact: {
            name: `Emergency ${i}`,
            relationship: 'Spouse',
            phone: `+12345678${(i + 50).toString().padStart(2, '0')}`
          }
        };

        return request(app)
          .post('/api/users')
          .set('Cookie', [`token=${managerToken}`])
          .send(userData);
      });

      const responses = await Promise.all(userPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/users?search=nonexistentuser')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(0);
    });

    it('should handle invalid sort parameters', async () => {
      const response = await request(app)
        .get('/api/users?sortBy=invalidField&sortOrder=invalidOrder')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});