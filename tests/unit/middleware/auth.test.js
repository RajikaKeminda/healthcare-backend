const jwt = require('jsonwebtoken');
const { verifyToken, authorize } = require('../../../middleware/auth');
const { createTestUser, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Auth Middleware', () => {
  describe('verifyToken', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        cookies: {},
        headers: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should verify valid token from cookie', async () => {
      const user = await createTestUser('patient');
      const token = generateToken(user._id, user.role);
      req.cookies.token = token;

      await verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should verify valid token from Authorization header', async () => {
      const user = await createTestUser('patient');
      const token = generateToken(user._id, user.role);
      req.headers.authorization = `Bearer ${token}`;

      await verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(user._id.toString());
    });

    it('should reject request without token', async () => {
      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.cookies.token = 'invalid.token.here';

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      const user = await createTestUser('patient');
      const expiredToken = jwt.sign(
        { _id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Already expired
      );
      req.cookies.token = expiredToken;

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      const token = generateToken(fakeUserId, 'patient');
      req.cookies.token = token;

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token for inactive user', async () => {
      const user = await createTestUser('patient');
      user.isActive = false;
      await user.save();

      const token = generateToken(user._id, user.role);
      req.cookies.token = token;

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User account is inactive',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        user: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should allow access for authorized role', () => {
      req.user.role = 'patient';
      const middleware = authorize('patient');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for multiple authorized roles', () => {
      req.user.role = 'hospital_staff';
      const middleware = authorize('patient', 'hospital_staff', 'healthcare_manager');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      req.user.role = 'patient';
      const middleware = authorize('healthcare_manager');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing user object', () => {
      req.user = undefined;
      const middleware = authorize('patient');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing role', () => {
      req.user = { name: 'Test User' }; // No role
      const middleware = authorize('patient');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should be case-sensitive for roles', () => {
      req.user.role = 'Patient'; // Wrong case
      const middleware = authorize('patient');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Combined Middleware Flow', () => {
    it('should successfully authenticate and authorize valid request', async () => {
      const user = await createTestUser('healthcare_manager');
      const token = generateToken(user._id, user.role);

      const req = {
        cookies: { token },
        headers: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // First verify token
      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();

      // Then authorize role
      const authorizeMiddleware = authorize('healthcare_manager');
      authorizeMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should fail at authorization even with valid token', async () => {
      const user = await createTestUser('patient');
      const token = generateToken(user._id, user.role);

      const req = {
        cookies: { token },
        headers: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // First verify token (should pass)
      await verifyToken(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Then try to authorize for wrong role (should fail)
      const authorizeMiddleware = authorize('healthcare_manager');
      authorizeMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).toHaveBeenCalledTimes(1); // Should not call next again
    });
  });
});

