const request = require('supertest');
const app = require('../../../app');
const { createTestUser, createTestHospital, generateToken } = require('../../utils/testHelpers');

require('../../setup');

describe('Hospitals Routes', () => {
  let manager, staff, patient, managerToken, staffToken, patientToken;

  beforeEach(async () => {
    manager = await createTestUser('healthcare_manager');
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

  describe('Edge Cases', () => {
    it('should handle hospitals with many departments', async () => {
      const departments = Array(50).fill(null).map((_, i) => `Department ${i + 1}`);
      const hospitalData = {
        name: 'Large Hospital',
        type: 'general',
        address: {
          street: '999 Big St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94118888888',
          email: 'large@hospital.lk',
        },
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
        type: 'general',
        address: {
          street: '123 Long St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94117777777',
          email: 'long@hospital.lk',
        },
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
        type: 'clinic',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94116666666',
        },
      };

      const promises = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/hospitals')
          .set('Cookie', [`token=${managerToken}`])
          .send({
            ...hospitalData,
            name: `Concurrent Hospital ${i}`,
            contactInfo: {
              ...hospitalData.contactInfo,
              email: `hospital${i}@test.lk`,
            },
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
        type: 'general',
        address: {
          street: '123 O\'Connor St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94115555555',
          email: 'info@stmarys.lk',
        },
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

