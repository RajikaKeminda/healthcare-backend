const request = require('supertest');
const app = require('../../../app');
const { createTestUser, createTestHospital, createTestAppointment, createBasicUser, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Hospitals Routes', () => {
  let manager, staff, patient, managerToken, staffToken, patientToken;

  beforeEach(async () => {
    manager = await createBasicUser();
    staff = await createTestUser('hospital_staff');
    patient = await createTestUser('patient');
    
    managerToken = generateToken(manager._id, manager.role);
    staffToken = generateToken(staff._id, staff.role);
    patientToken = generateToken(patient._id, patient.role);
  });

  describe('POST /api/hospitals - Create Hospital', () => {
    it('should create hospital as manager', async () => {
      const hospitalData = {
        name: 'New Medical Center',
        type: 'general',
        address: {
          street: '123 Hospital Ave',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000',
          country: 'Sri Lanka',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'info@newmedical.lk',
        },
        departments: ['Cardiology', 'Neurology'],
        facilities: ['ICU', 'Emergency Room'],
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital).toBeDefined();
      expect(response.body.data.hospital.name).toBe('New Medical Center');
      expect(response.body.data.hospital.type).toBe('general');
    });

    it('should create specialized hospital', async () => {
      const hospitalData = {
        name: 'Heart Center',
        type: 'specialized',
        address: {
          street: '456 Cardiac Way',
          city: 'Kandy',
          zipCode: '20000',
        },
        contactInfo: {
          phone: '+94812345678',
          email: 'info@heartcenter.lk',
        },
        specializations: ['Cardiac Surgery', 'Interventional Cardiology'],
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.type).toBe('specialized');
      expect(response.body.data.hospital.specializations).toContain('Cardiac Surgery');
    });

    it('should fail without required fields', async () => {
      const incompleteData = {
        name: 'Incomplete Hospital',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const hospitalData = {
        name: 'Invalid Email Hospital',
        type: 'general',
        address: {
          street: '789 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'invalid-email',
        },
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid hospital type', async () => {
      const hospitalData = {
        name: 'Invalid Type Hospital',
        type: 'invalid_type',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk',
        },
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'general',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk',
        },
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${patientToken}`])
        .send(hospitalData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/hospitals - Get All Hospitals', () => {
    beforeEach(async () => {
      // Create multiple hospitals
      await createTestHospital({ name: 'Hospital A', type: 'general' });
      await createTestHospital({ name: 'Hospital B', type: 'specialized' });
      await createTestHospital({ name: 'Hospital C', type: 'clinic' });
    });

    it('should get all hospitals', async () => {
      const response = await request(app)
        .get('/api/hospitals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals).toBeInstanceOf(Array);
      expect(response.body.data.hospitals.length).toBeGreaterThan(0);
    });

    it('should filter hospitals by type', async () => {
      const response = await request(app)
        .get('/api/hospitals?type=specialized')
        .expect(200);

      expect(response.body.success).toBe(true);
      const hospitals = response.body.data.hospitals;
      expect(hospitals.every(h => h.type === 'specialized')).toBe(true);
    });

    it('should filter hospitals by city', async () => {
      await createTestHospital({ 
        name: 'Colombo Hospital',
        address: { street: '123', city: 'Colombo', zipCode: '10000' }
      });

      const response = await request(app)
        .get('/api/hospitals?city=Colombo')
        .expect(200);

      expect(response.body.success).toBe(true);
      const hospitals = response.body.data.hospitals;
      expect(hospitals.some(h => h.address.city === 'Colombo')).toBe(true);
    });

    it('should search hospitals by name', async () => {
      await createTestHospital({ name: 'Central Medical Center' });

      const response = await request(app)
        .get('/api/hospitals?search=Central')
        .expect(200);

      expect(response.body.success).toBe(true);
      const hospitals = response.body.data.hospitals;
      expect(hospitals.some(h => h.name.includes('Central'))).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/hospitals?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should filter by active status', async () => {
      const inactiveHospital = await createTestHospital({ name: 'Inactive Hospital' });
      inactiveHospital.isActive = false;
      await inactiveHospital.save();

      const response = await request(app)
        .get('/api/hospitals?isActive=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      const hospitals = response.body.data.hospitals;
      expect(hospitals.every(h => h.isActive === true)).toBe(true);
    });

    it('should work without authentication for public access', async () => {
      const response = await request(app)
        .get('/api/hospitals')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/hospitals/:id - Get Hospital By ID', () => {
    let hospital;

    beforeEach(async () => {
      hospital = await createTestHospital();
    });

    it('should get hospital by ID', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital._id).toBe(hospital._id.toString());
      expect(response.body.data.hospital.name).toBe(hospital.name);
    });

    it('should include all hospital details', async () => {
      const fullHospital = await createTestHospital({
        departments: ['Cardiology', 'Neurology'],
        facilities: ['ICU', 'Lab'],
        operatingHours: {
          monday: { open: '08:00', close: '17:00' },
        },
      });

      const response = await request(app)
        .get(`/api/hospitals/${fullHospital._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const data = response.body.data.hospital;
      expect(data.departments).toContain('Cardiology');
      expect(data.facilities).toContain('ICU');
      expect(data.operatingHours.monday.open).toBe('08:00');
    });

    it('should fail with invalid hospital ID', async () => {
      const response = await request(app)
        .get('/api/hospitals/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/hospitals/:id - Update Hospital', () => {
    let hospital;

    beforeEach(async () => {
      hospital = await createTestHospital();
    });

    it('should update hospital as manager', async () => {
      const updates = {
        name: 'Updated Hospital Name',
        contactInfo: {
          phone: '+94119999999',
          email: 'updated@hospital.lk',
        },
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.name).toBe('Updated Hospital Name');
      expect(response.body.data.hospital.contactInfo.phone).toBe('+94119999999');
    });

    it('should update departments and facilities', async () => {
      const updates = {
        departments: ['Surgery', 'Pediatrics', 'Orthopedics'],
        facilities: ['MRI', 'CT Scan', 'X-Ray'],
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.departments).toContain('Surgery');
      expect(response.body.data.hospital.facilities).toContain('MRI');
    });

    it('should update operating hours', async () => {
      const updates = {
        operatingHours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
        },
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.operatingHours.monday.open).toBe('09:00');
    });

    it('should toggle active status', async () => {
      const updates = { isActive: false };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.isActive).toBe(false);
    });

    it('should fail with invalid email', async () => {
      const updates = {
        contactInfo: {
          email: 'invalid-email',
        },
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const updates = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${patientToken}`])
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid hospital ID', async () => {
      const updates = { name: 'Updated' };

      const response = await request(app)
        .put('/api/hospitals/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/hospitals/:id - Delete Hospital', () => {
    let hospital;

    beforeEach(async () => {
      hospital = await createTestHospital();
    });

    it('should delete hospital as manager', async () => {
      const response = await request(app)
        .delete(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should fail with invalid hospital ID', async () => {
      const response = await request(app)
        .delete('/api/hospitals/507f1f77bcf86cd799439011')
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should fail for unauthorized roles', async () => {
      const response = await request(app)
        .delete(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${staffToken}`])
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // Additional tests to cover specific lines mentioned
  describe('GET /api/hospitals - Enhanced Coverage (Lines 17-59)', () => {
    beforeEach(async () => {
      // Create test hospitals with different types
      await createTestHospital({ 
        name: 'Public Hospital', 
        type: 'public',
        address: { street: '123 Main St', city: 'Colombo', state: 'Western', zipCode: '10000' },
        specializations: ['Cardiology', 'Neurology']
      });
      await createTestHospital({ 
        name: 'Private Clinic', 
        type: 'private',
        address: { street: '456 Oak Ave', city: 'Kandy', state: 'Central', zipCode: '20000' },
        specializations: ['Dermatology']
      });
      await createTestHospital({ 
        name: 'Teaching Hospital', 
        type: 'teaching',
        address: { street: '789 Pine St', city: 'Colombo', state: 'Western', zipCode: '10001' },
        specializations: ['General Medicine', 'Surgery']
      });
    });

    it('should validate query parameters correctly', async () => {
      // Test invalid page parameter
      const response1 = await request(app)
        .get('/api/hospitals?page=0')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.message).toBe('Validation failed');

      // Test invalid limit parameter
      const response2 = await request(app)
        .get('/api/hospitals?limit=101')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response2.body.success).toBe(false);
      expect(response2.body.message).toBe('Validation failed');

      // Test invalid type parameter
      const response3 = await request(app)
        .get('/api/hospitals?type=invalid')
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response3.body.success).toBe(false);
      expect(response3.body.message).toBe('Validation failed');
    });

    it('should filter by hospital type correctly', async () => {
      const response = await request(app)
        .get('/api/hospitals?type=public')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals.every(h => h.type === 'public')).toBe(true);
    });

    it('should filter by city with case-insensitive search', async () => {
      const response = await request(app)
        .get('/api/hospitals?city=colombo')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals.every(h => 
        h.address.city.toLowerCase().includes('colombo')
      )).toBe(true);
    });

    it('should filter by specialization', async () => {
      const response = await request(app)
        .get('/api/hospitals?specialization=Cardiology')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals.some(h => 
        h.specializations && h.specializations.includes('Cardiology')
      )).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/hospitals?page=1&limit=2')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospitals.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(2);
      expect(response.body.data.pagination.totalPages).toBeGreaterThan(0);
    });

    it('should sort hospitals by name', async () => {
      const response = await request(app)
        .get('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const hospitals = response.body.data.hospitals;
      for (let i = 1; i < hospitals.length; i++) {
        expect(hospitals[i-1].name <= hospitals[i].name).toBe(true);
      }
    });

    it('should handle server errors gracefully', async () => {
      // Mock Hospital.find to throw an error
      const originalFind = require('../../../models/Hospital').find;
      require('../../../models/Hospital').find = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching hospitals');

      // Restore original function
      require('../../../models/Hospital').find = originalFind;
    });
  });

  describe('GET /api/hospitals/:hospitalID - Enhanced Coverage (Lines 69-87)', () => {
    let hospital;

    beforeEach(async () => {
      hospital = await createTestHospital({
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        specializations: ['Cardiology', 'Neurology'],
        facilities: ['ICU', 'Emergency Room']
      });
    });

    it('should get hospital by ID with authentication', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital._id).toBe(hospital._id.toString());
      expect(response.body.data.hospital.name).toBe('Test Hospital');
      expect(response.body.data.hospital.type).toBe('public');
    });

    it('should return 404 for non-existent hospital', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/hospitals/${fakeId}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Hospital not found');
    });

    it('should handle invalid ObjectId format', async () => {
      const response = await request(app)
        .get('/api/hospitals/invalid-id')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching hospital');
    });

    it('should handle server errors gracefully', async () => {
      // Mock Hospital.findById to throw an error
      const originalFindById = require('../../../models/Hospital').findById;
      require('../../../models/Hospital').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching hospital');

      // Restore original function
      require('../../../models/Hospital').findById = originalFindById;
    });
  });

  describe('GET /api/hospitals/:hospitalID/doctors - Enhanced Coverage (Lines 100-150)', () => {
    let hospital, doctor1, doctor2;

    beforeEach(async () => {
      hospital = await createTestHospital({
        name: 'Test Hospital',
        specializations: ['Cardiology', 'Neurology']
      });

      doctor1 = await createTestUser('healthcare_professional', {
        specialization: 'Cardiology',
        isAvailable: true,
        workingHours: { start: '09:00', end: '17:00' },
        bio: 'Experienced cardiologist',
        languages: ['English', 'Sinhala']
      });

      doctor2 = await createTestUser('healthcare_professional', {
        specialization: 'Neurology',
        isAvailable: false,
        workingHours: { start: '08:00', end: '16:00' },
        bio: 'Neurology specialist',
        languages: ['English']
      });
    });

    it('should get doctors by hospital with validation', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.id).toBe(hospital._id.toString());
      expect(response.body.data.hospital.name).toBe('Test Hospital');
      expect(response.body.data.doctors).toBeInstanceOf(Array);
    });

    it('should validate query parameters for doctors endpoint', async () => {
      // Test invalid available parameter
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors?available=invalid`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should filter doctors by specialization', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors?specialization=Cardiology`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doctors.every(d => d.specialization === 'Cardiology')).toBe(true);
    });

    it('should filter doctors by availability', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors?available=true`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doctors.every(d => d.isAvailable === true)).toBe(true);
    });

    it('should return 404 for non-existent hospital', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/hospitals/${fakeId}/doctors`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Hospital not found');
    });

    it('should select only required doctor fields', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const doctor = response.body.data.doctors[0];
      expect(doctor).toHaveProperty('userName');
      expect(doctor).toHaveProperty('email');
      expect(doctor).toHaveProperty('specialization');
      expect(doctor).toHaveProperty('consultationFee');
      expect(doctor).toHaveProperty('isAvailable');
      expect(doctor).toHaveProperty('workingHours');
      expect(doctor).toHaveProperty('bio');
      expect(doctor).toHaveProperty('languages');
      expect(doctor).not.toHaveProperty('password');
    });

    it('should sort doctors by specialization and name', async () => {
      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const doctors = response.body.data.doctors;
      for (let i = 1; i < doctors.length; i++) {
        const prev = doctors[i-1];
        const curr = doctors[i];
        expect(prev.specialization <= curr.specialization).toBe(true);
        if (prev.specialization === curr.specialization) {
          expect(prev.userName <= curr.userName).toBe(true);
        }
      }
    });

    it('should handle server errors gracefully', async () => {
      // Mock Hospital.findById to throw an error
      const originalFindById = require('../../../models/Hospital').findById;
      require('../../../models/Hospital').findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/hospitals/${hospital._id}/doctors`)
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching hospital doctors');

      // Restore original function
      require('../../../models/Hospital').findById = originalFindById;
    });
  });

  describe('POST /api/hospitals - Enhanced Coverage (Lines 170-192)', () => {
    it('should validate all required fields', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000',
          country: 'Sri Lanka'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: {
          totalBeds: 100,
          occupiedBeds: 50,
          icuBeds: 10,
          emergencyBeds: 5
        }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Hospital created successfully');
      expect(response.body.data.hospital.name).toBe('Test Hospital');
      expect(response.body.data.hospital.type).toBe('public');
    });

    it('should validate hospital name is required', async () => {
      const hospitalData = {
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate hospital type is valid', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'invalid_type',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate address fields are required', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          // Missing city, state, zipCode
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate contact info fields', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'invalid-email'
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate capacity totalBeds is positive integer', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 0 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle server errors gracefully', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 100 }
      };

      // Mock Hospital.save to throw an error
      const originalSave = require('../../../models/Hospital').prototype.save;
      require('../../../models/Hospital').prototype.save = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while creating hospital');

      // Restore original function
      require('../../../models/Hospital').prototype.save = originalSave;
    });
  });

  describe('PUT /api/hospitals/:hospitalID - Enhanced Coverage (Lines 206-240)', () => {
    let hospital;

    beforeEach(async () => {
      hospital = await createTestHospital({
        name: 'Original Hospital',
        type: 'public',
        contactInfo: {
          phone: '+94112345678',
          email: 'original@hospital.lk'
        }
      });
    });

    it('should validate optional fields when provided', async () => {
      const updates = {
        name: 'Updated Hospital Name',
        type: 'private',
        contactInfo: {
          email: 'updated@hospital.lk'
        }
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Hospital updated successfully');
      expect(response.body.data.hospital.name).toBe('Updated Hospital Name');
      expect(response.body.data.hospital.type).toBe('private');
    });

    it('should validate hospital name cannot be empty', async () => {
      const updates = {
        name: ''
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate hospital type is valid when provided', async () => {
      const updates = {
        type: 'invalid_type'
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate email format when provided', async () => {
      const updates = {
        contactInfo: {
          email: 'invalid-email'
        }
      };

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 404 for non-existent hospital', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const updates = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/hospitals/${fakeId}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Hospital not found');
    });

    it('should handle server errors gracefully', async () => {
      const updates = { name: 'Updated Name' };

      // Mock Hospital.findByIdAndUpdate to throw an error
      const originalFindByIdAndUpdate = require('../../../models/Hospital').findByIdAndUpdate;
      require('../../../models/Hospital').findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put(`/api/hospitals/${hospital._id}`)
        .set('Cookie', [`token=${managerToken}`])
        .send(updates)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while updating hospital');

      // Restore original function
      require('../../../models/Hospital').findByIdAndUpdate = originalFindByIdAndUpdate;
    });
  });

  describe('GET /api/hospitals/specializations/list - Enhanced Coverage (Lines 250-263)', () => {
    beforeEach(async () => {
      // Create healthcare professionals with different specializations
      await createTestUser('healthcare_professional', {
        specialization: 'Cardiology',
        isActive: true
      });
      await createTestUser('healthcare_professional', {
        specialization: 'Neurology',
        isActive: true
      });
      await createTestUser('healthcare_professional', {
        specialization: 'Dermatology',
        isActive: true
      });
      await createTestUser('healthcare_professional', {
        specialization: 'Cardiology', // Duplicate specialization
        isActive: true
      });
      await createTestUser('healthcare_professional', {
        specialization: 'Inactive Specialty',
        isActive: false // Should not be included
      });
    });

    it('should get list of specializations', async () => {
      const response = await request(app)
        .get('/api/hospitals/specializations/list')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specializations).toBeInstanceOf(Array);
      expect(response.body.data.specializations.length).toBeGreaterThan(0);
    });

    it('should return unique specializations only', async () => {
      const response = await request(app)
        .get('/api/hospitals/specializations/list')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const specializations = response.body.data.specializations;
      const uniqueSpecializations = [...new Set(specializations)];
      expect(specializations.length).toBe(uniqueSpecializations.length);
    });

    it('should return specializations sorted alphabetically', async () => {
      const response = await request(app)
        .get('/api/hospitals/specializations/list')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const specializations = response.body.data.specializations;
      for (let i = 1; i < specializations.length; i++) {
        expect(specializations[i-1] <= specializations[i]).toBe(true);
      }
    });

    it('should only include active healthcare professionals', async () => {
      const response = await request(app)
        .get('/api/hospitals/specializations/list')
        .set('Cookie', [`token=${managerToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      const specializations = response.body.data.specializations;
      expect(specializations).not.toContain('Inactive Specialty');
    });

    it('should handle server errors gracefully', async () => {
      // Mock HealthcareProfessional.distinct to throw an error
      const originalDistinct = require('../../../models/HealthcareProfessional').distinct;
      require('../../../models/HealthcareProfessional').distinct = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/hospitals/specializations/list')
        .set('Cookie', [`token=${managerToken}`])
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error while fetching specializations');

      // Restore original function
      require('../../../models/HealthcareProfessional').distinct = originalDistinct;
    });
  });

  describe('Edge Cases', () => {
    it('should handle hospitals with many departments', async () => {
      const departments = Array(50).fill(null).map((_, i) => `Department ${i + 1}`);
      const hospitalData = {
        name: 'Large Hospital',
        type: 'public',
        address: {
          street: '999 Big St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94118888888',
          email: 'large@hospital.lk',
        },
        capacity: { totalBeds: 100 },
        departments,
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.departments).toHaveLength(50);
    });

    it('should handle very long hospital names', async () => {
      const longName = 'The '.repeat(50) + 'Hospital';
      const hospitalData = {
        name: longName,
        type: 'public',
        address: {
          street: '123 Long St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94117777777',
          email: 'long@hospital.lk',
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.name).toBe(longName);
    });

    it('should handle concurrent hospital creations', async () => {
      const hospitalData = {
        type: 'public',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94116666666',
          email: 'test@hospital.lk'
        },
        capacity: { totalBeds: 100 }
      };

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/hospitals')
          .set('Cookie', [`token=${managerToken}`])
          .send({
            ...hospitalData,
            name: `Concurrent Hospital ${i}`,
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle special characters in hospital data', async () => {
      const hospitalData = {
        name: 'St. Mary\'s & Children\'s Hospital',
        type: 'public',
        address: {
          street: '123 O\'Connor St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000'
        },
        contactInfo: {
          phone: '+94115555555',
          email: 'info@stmarys.lk',
        },
        capacity: { totalBeds: 100 }
      };

      const response = await request(app)
        .post('/api/hospitals')
        .set('Cookie', [`token=${managerToken}`])
        .send(hospitalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hospital.name).toContain('St. Mary\'s');
    });
  });
});

