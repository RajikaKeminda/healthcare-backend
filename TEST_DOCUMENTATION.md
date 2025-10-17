# Backend Test Documentation

## Overview

This document provides comprehensive information about the testing strategy, structure, and execution for the Healthcare System backend.

## Test Structure

```
backend/tests/
├── setup.js                    # Global test setup and configuration
├── utils/
│   └── testHelpers.js         # Reusable test utilities and fixtures
├── unit/
│   ├── models/                # Unit tests for Mongoose models
│   │   ├── User.test.js
│   │   └── Appointment.test.js
│   └── middleware/            # Unit tests for middleware
│       └── auth.test.js
└── integration/
    └── routes/                # Integration tests for API routes
        ├── auth.test.js
        └── appointments.test.js
```

## Test Coverage Goals

- **Minimum Coverage**: 80% for all metrics
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Running Tests

### Run All Tests
```bash
cd backend
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Only Unit Tests
```bash
npm run test:unit
```

### Run Only Integration Tests
```bash
npm run test:integration
```

### Generate Coverage Report
```bash
npm test -- --coverage
```

## Test Categories

### 1. Model Tests (Unit)

**Location**: `tests/unit/models/`

**Purpose**: Test Mongoose model validation, methods, and business logic

**Examples**:
- User model creation with valid/invalid data
- Password hashing functionality
- Model discriminators (Patient, HealthcareProfessional)
- Field validation and enum constraints
- Unique constraint handling

**Key Features**:
- ✅ Positive cases (valid data)
- ✅ Negative cases (invalid data)
- ✅ Edge cases (boundary values, special characters)
- ✅ Error handling
- ✅ Schema validation

### 2. Middleware Tests (Unit)

**Location**: `tests/unit/middleware/`

**Purpose**: Test authentication and authorization middleware

**Examples**:
- JWT token verification
- Role-based access control
- Invalid/expired token handling
- Missing token scenarios
- Inactive user handling

**Key Features**:
- ✅ Token validation
- ✅ Authorization logic
- ✅ Error responses
- ✅ Edge cases (malformed tokens, expired tokens)

### 3. Route Tests (Integration)

**Location**: `tests/integration/routes/`

**Purpose**: Test complete HTTP request/response cycles

**Examples**:
- Authentication endpoints (register, login, logout)
- CRUD operations (create, read, update, delete)
- Query parameter handling
- Request validation
- Authorization checks

**Key Features**:
- ✅ Full request/response flow
- ✅ Database interactions
- ✅ Authentication/authorization
- ✅ Error handling
- ✅ Status codes
- ✅ Response structure

## Test Utilities

### Test Helpers (`tests/utils/testHelpers.js`)

**Functions**:

1. `generateToken(userId, role)` - Generate JWT tokens for testing
2. `createTestUser(role, overrides)` - Create test user with specific role
3. `createTestHospital(overrides)` - Create test hospital
4. `createTestAppointment(patient, doctor, hospital, overrides)` - Create test appointment
5. `createTestPayment(patient, hospital, overrides)` - Create test payment
6. `createTestMedicalRecord(patient, doctor, hospital, overrides)` - Create test medical record

**Usage Example**:
```javascript
const { createTestUser, generateToken } = require('../../utils/testHelpers');

const patient = await createTestUser('patient');
const token = generateToken(patient._id, patient.role);
```

### Test Setup (`tests/setup.js`)

**Features**:
- MongoDB Memory Server for isolated testing
- Automatic database cleanup after each test
- Environment variable configuration
- Global test lifecycle management

## Writing New Tests

### Best Practices

1. **Descriptive Test Names**
   ```javascript
   it('should create appointment with valid data', async () => {
     // Test implementation
   });
   ```

2. **Arrange-Act-Assert Pattern**
   ```javascript
   it('should login successfully', async () => {
     // Arrange
     const credentials = { email: 'test@test.com', password: 'Password123!' };
     
     // Act
     const response = await request(app)
       .post('/api/auth/login')
       .send(credentials);
     
     // Assert
     expect(response.status).toBe(200);
     expect(response.body.success).toBe(true);
   });
   ```

3. **Test Independence**
   - Each test should be independent
   - Use `beforeEach` for test setup
   - Database is automatically cleared after each test

4. **Meaningful Assertions**
   ```javascript
   expect(user).toBeDefined();
   expect(user.email).toBe('test@test.com');
   expect(user.password).not.toBe('plaintext');
   expect(user.isActive).toBe(true);
   ```

5. **Edge Case Coverage**
   - Test boundary values
   - Test with missing data
   - Test with invalid formats
   - Test concurrent operations

### Example Test Structure

```javascript
const { createTestUser } = require('../../utils/testHelpers');
require('../../setup');

describe('Feature Name', () => {
  describe('Positive Cases', () => {
    it('should handle valid input', async () => {
      // Test valid scenarios
    });
  });

  describe('Negative Cases', () => {
    it('should reject invalid input', async () => {
      // Test invalid scenarios
    });
    
    it('should handle missing required fields', async () => {
      // Test validation
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary values', async () => {
      // Test edge cases
    });
    
    it('should handle special characters', async () => {
      // Test special scenarios
    });
  });

  describe('Error Handling', () => {
    it('should return appropriate error messages', async () => {
      // Test error responses
    });
  });
});
```

## Test Data Management

### Using Test Fixtures

```javascript
const patient = await createTestUser('patient', {
  email: 'custom@test.com',
  bloodType: 'A+',
});
```

### Cleanup

- Database is automatically cleared after each test
- No manual cleanup required
- Memory server is stopped after all tests

## Common Assertions

### Status Codes
```javascript
expect(response.status).toBe(200);  // Success
expect(response.status).toBe(201);  // Created
expect(response.status).toBe(400);  // Bad Request
expect(response.status).toBe(401);  // Unauthorized
expect(response.status).toBe(403);  // Forbidden
expect(response.status).toBe(404);  // Not Found
```

### Response Structure
```javascript
expect(response.body.success).toBe(true);
expect(response.body.data).toBeDefined();
expect(response.body.message).toContain('expected text');
```

### Array and Object Assertions
```javascript
expect(array).toBeInstanceOf(Array);
expect(array.length).toBeGreaterThan(0);
expect(object).toHaveProperty('key');
expect(value).toMatch(/regex pattern/);
```

## Continuous Integration

### CI Configuration

The test suite is designed to run in CI environments:

```bash
npm run test:ci
```

This command:
- Runs all tests once (no watch mode)
- Generates coverage reports
- Limits worker threads for CI environments
- Fails if coverage thresholds are not met

## Troubleshooting

### Common Issues

1. **MongoDB Connection Errors**
   - Ensure MongoDB Memory Server is properly installed
   - Check `tests/setup.js` configuration

2. **Test Timeouts**
   - Increase Jest timeout in problematic tests:
     ```javascript
     jest.setTimeout(10000); // 10 seconds
     ```

3. **Async Test Issues**
   - Always use `async/await` or return promises
   - Use `waitFor` for asynchronous operations

4. **Port Conflicts**
   - Tests use MongoDB Memory Server (no port conflicts)
   - Supertest handles Express app automatically

## Coverage Reports

After running tests with coverage, view the report:

```bash
open coverage/lcov-report/index.html
```

Coverage reports show:
- File-by-file coverage statistics
- Line-by-line coverage visualization
- Uncovered code paths highlighted in red

## Metrics and Quality

### Current Coverage

Run `npm test` to see current coverage metrics.

### Quality Criteria

- ✅ All tests pass
- ✅ >80% coverage across all metrics
- ✅ No console errors in tests
- ✅ Tests complete in reasonable time (<30s for full suite)
- ✅ Tests are deterministic (no flaky tests)

## Contributing

When adding new features:

1. Write tests first (TDD approach) or alongside feature
2. Ensure all existing tests still pass
3. Maintain >80% coverage
4. Follow existing test patterns
5. Document complex test scenarios
6. Use meaningful test descriptions

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Testing Best Practices](https://testingjavascript.com/)

