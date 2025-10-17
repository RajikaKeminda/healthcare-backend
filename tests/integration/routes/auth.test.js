const request = require('supertest');
const app = require('../../../app');
const User = require('../../../models/User');
const { createTestUser } = require('../../utils/testHelpers');

require('../../setup');

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new patient successfully', async () => {
      const userData = {
        userName: 'newpatient',
        email: 'newpatient@test.com',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000',
          country: 'Sri Lanka',
        },
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registered successfully');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined(); // Should not return password

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeDefined();
      expect(user.userName).toBe(userData.userName);
    });

    it('should fail with missing required fields', async () => {
      const incompleteData = {
        email: 'incomplete@test.com',
        password: 'Test123!@#',
        // Missing userName, phone, dateOfBirth
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        userName: 'testuser',
        email: 'invalid-email',
        password: 'Test123!@#',
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      await createTestUser('patient', { email: 'existing@test.com' });

      const userData = {
        userName: 'newuser',
        email: 'existing@test.com',
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

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exists');
    });

    it('should hash password before saving', async () => {
      const password = 'Test123!@#';
      const userData = {
        userName: 'hashtest',
        email: 'hashtest@test.com',
        password,
        phone: '+94771234567',
        dateOfBirth: '1990-01-01',
        role: 'patient',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const user = await User.findOne({ email: userData.email });
      expect(user.password).not.toBe(password);
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;
    const testPassword = 'Test123!@#';

    beforeEach(async () => {
      testUser = await createTestUser('patient', {
        email: 'login@test.com',
        password: testPassword,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: testPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('login@test.com');
      expect(response.body.data.user.password).toBeUndefined();

      // Check for httpOnly cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('token='))).toBe(true);
      expect(cookies.some(cookie => cookie.includes('httpOnly'))).toBe(true);
    });

    it('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testPassword,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for inactive user', async () => {
      testUser.isActive = false;
      await testUser.save();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('inactive');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out');

      // Check for cookie removal
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('token=') && cookie.includes('Max-Age=0'))).toBe(true);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify valid token and return user', async () => {
      const user = await createTestUser('patient');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#',
        });

      const cookies = loginResponse.headers['set-cookie'];

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(user.email);
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Cookie', ['token=invalid.token.here'])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('Edge Cases', () => {
    it('should handle SQL injection attempts in email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin'--",
          password: 'anything',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle very long inputs', async () => {
      const longString = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          userName: longString,
          email: 'test@test.com',
          password: 'Test123!@#',
          phone: '+94771234567',
          dateOfBirth: '1990-01-01',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'T3st!@#$%^&*()_+-={}[]|:;<>?,./';
      const userData = {
        userName: 'specialchar',
        email: 'specialchar@test.com',
        password: specialPassword,
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
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify can login with special chars
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'specialchar@test.com',
          password: specialPassword,
        })
        .expect(200);
    });
  });
});

