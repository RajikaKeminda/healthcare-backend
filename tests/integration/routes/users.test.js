const request = require('supertest');
const app = require('../../../app');
const { createTestUser, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Users Routes', () => {
  let manager, managerToken, staffToken, patientToken;

  beforeEach(async () => {
    manager = await createTestUser('healthcare_manager');
    const staff = await createTestUser('hospital_staff');
    const patient = await createTestUser('patient');
    
    managerToken = generateToken(manager._id, manager.role);
    staffToken = generateToken(staff._id, staff.role);
    patientToken = generateToken(patient._id, patient.role);
  });

  describe('GET /api/users - Get All Users', () => {
    beforeEach(async () => {
      // Create multiple users
      await createTestUser('patient', { userName: 'Patient 1' });
      await createTestUser('patient', { userName: 'Patient 2' });
      await createTestUser('healthcare_professional', { userName: 'Doctor 1' });
    });

    it('should get all users as manager', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeInstanceOf(Array);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users?role=patient')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const users = response.body.data.users;
      expect(users.every(user => user.role === 'patient')).toBe(true);
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

    it('should search users by name or email', async () => {
      await createTestUser('patient', { 
        userName: 'John Doe',
        email: 'john.doe@test.com' 
      });

      const response = await request(app)
        .get('/api/users?search=John')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.some(u => u.userName.includes('John'))).toBe(true);
    });

    it('should sort users', async () => {
      const response = await request(app)
        .get('/api/users?sortBy=userName&sortOrder=asc')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const userNames = response.body.data.users.map(u => u.userName);
      const sortedNames = [...userNames].sort();
      expect(userNames).toEqual(sortedNames);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not return 304 (should set Cache-Control)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
    });
  });

  describe('GET /api/users/:id - Get User By ID', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await createTestUser('patient');
    });

    it('should get user by ID as manager', async () => {
      const response = await request(app)
        .get(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user._id).toBe(testPatient._id.toString());
      expect(response.body.data.user.userName).toBe(testPatient.userName);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should fail with invalid user ID', async () => {
      const response = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/users/${testPatient._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users - Create User', () => {
    it('should create patient as manager', async () => {
      const userData = {
        userName: 'New Patient',
        email: 'newpatient@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1995-06-15',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000',
          country: 'Sri Lanka',
        },
        bloodType: 'A+',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe('patient');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should create healthcare professional as manager', async () => {
      const userData = {
        userName: 'Dr. New Doctor',
        email: 'newdoctor@test.com',
        password: 'Test123!@#',
        phone: '+94771234568',
        dateOfBirth: '1985-03-20',
        role: 'healthcare_professional',
        address: {
          street: '456 Medical St',
          city: 'Colombo',
          zipCode: '10000',
        },
        specialization: 'Cardiology',
        licenseNumber: 'LIC789012',
        consultationFee: 3500,
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('healthcare_professional');
      expect(response.body.data.user.specialization).toBe('Cardiology');
    });

    it('should fail with missing required fields', async () => {
      const incompleteData = {
        userName: 'Incomplete User',
        email: 'incomplete@test.com',
        // Missing password, phone, dateOfBirth
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        userName: 'Test User',
        email: 'invalid-email',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const existingUser = await createTestUser('patient', { 
        email: 'existing@test.com' 
      });

      const userData = {
        userName: 'Duplicate Email User',
        email: 'existing@test.com',
        password: 'Test123!@#',
        phone: '+94771234569',
        dateOfBirth: '1990-01-01',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exists');
    });

    it('should fail for unauthorized roles', async () => {
      const userData = {
        userName: 'Test User',
        email: 'test@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${patientToken}`])
        .send(userData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id - Update User', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await createTestUser('patient');
    });

    it('should update user as manager', async () => {
      const updates = {
        userName: 'Updated Name',
        phone: '+94779999999',
      };

      const response = await request(app)
        .put(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.userName).toBe('Updated Name');
      expect(response.body.data.user.phone).toBe('+94779999999');
    });

    it('should update patient-specific fields', async () => {
      const updates = {
        bloodType: 'B+',
        height: 175,
        weight: 72,
      };

      const response = await request(app)
        .put(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.bloodType).toBe('B+');
    });

    it('should update isActive status', async () => {
      const updates = {
        isActive: false,
      };

      const response = await request(app)
        .put(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isActive).toBe(false);
    });

    it('should fail with invalid user ID', async () => {
      const updates = { userName: 'Updated' };

      const response = await request(app)
        .put('/api/users/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const updates = { userName: 'Updated' };

      const response = await request(app)
        .put(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not allow updating to duplicate email', async () => {
      const anotherUser = await createTestUser('patient', {
        email: 'another@test.com',
      });

      const updates = {
        email: anotherUser.email,
      };

      const response = await request(app)
        .put(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/:id - Delete User', () => {
    let testPatient;

    beforeEach(async () => {
      testPatient = await createTestUser('patient');
    });

    it('should delete user as manager', async () => {
      const response = await request(app)
        .delete(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
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
        .delete(`/api/users/${testPatient._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app)
        .delete(`/api/users/${manager._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('delete your own');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent user creations', async () => {
      const userData = {
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
      };

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/users')
          .set('Cookie', [`token=${managerToken}`])
          .send({
            ...userData,
            userName: `User ${i}`,
            email: `user${i}@test.com`,
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle very long search queries', async () => {
      const longSearch = 'search'.repeat(100);
      const response = await request(app)
        .get(`/api/users?search=${longSearch}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle invalid pagination values', async () => {
      const response = await request(app)
        .get('/api/users?page=-1&limit=0')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in user data', async () => {
      const userData = {
        userName: 'Test User <script>alert("xss")</script>',
        email: 'special@test.com',
        password: 'Test123!@#$%^&*()',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', [`token=${managerToken}`])
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // Should store as-is or sanitized
      expect(response.body.data.user.userName).toBeDefined();
    });
  });
});

