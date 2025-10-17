const Hospital = require('../../../models/Hospital');

require('../../setup');

describe('Hospital Model', () => {
  describe('Hospital Creation', () => {
    it('should create a valid hospital with required fields', async () => {
      const hospitalData = {
        name: 'Central Hospital',
        type: 'general',
        address: {
          street: '123 Main St',
          city: 'Colombo',
          state: 'Western',
          zipCode: '10000',
          country: 'Sri Lanka',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'info@centralhospital.lk',
        },
      };

      const hospital = await Hospital.create(hospitalData);

      expect(hospital).toBeDefined();
      expect(hospital.name).toBe('Central Hospital');
      expect(hospital.type).toBe('general');
      expect(hospital.address.city).toBe('Colombo');
    });

    it('should fail without required fields', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        // Missing required fields
      };

      await expect(Hospital.create(hospitalData)).rejects.toThrow();
    });

    it('should validate hospital type enum', async () => {
      const hospitalData = {
        name: 'Test Hospital',
        type: 'invalid_type',
        address: {
          street: '123 Main St',
          city: 'Colombo',
          zipCode: '10000',
        },
      };

      await expect(Hospital.create(hospitalData)).rejects.toThrow();
    });

    it('should set default type to general', async () => {
      const hospital = await Hospital.create({
        name: 'Default Type Hospital',
        address: {
          street: '123 Main St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk',
        },
      });

      expect(hospital.type).toBe('general');
    });

    it('should set default isActive to true', async () => {
      const hospital = await Hospital.create({
        name: 'Active Hospital',
        type: 'general',
        address: {
          street: '123 Main St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'test@hospital.lk',
        },
      });

      expect(hospital.isActive).toBe(true);
    });
  });

  describe('Contact Information', () => {
    it('should store complete contact info', async () => {
      const hospital = await Hospital.create({
        name: 'Contact Test Hospital',
        type: 'general',
        address: {
          street: '456 Hospital Ave',
          city: 'Kandy',
          state: 'Central',
          zipCode: '20000',
        },
        contactInfo: {
          phone: '+94812345678',
          email: 'contact@hospital.lk',
          fax: '+94812345679',
          website: 'https://hospital.lk',
          emergencyHotline: '+94812222222',
        },
      });

      expect(hospital.contactInfo.phone).toBe('+94812345678');
      expect(hospital.contactInfo.email).toBe('contact@hospital.lk');
      expect(hospital.contactInfo.website).toBe('https://hospital.lk');
      expect(hospital.contactInfo.emergencyHotline).toBe('+94812222222');
    });

    it('should validate email format', async () => {
      const hospitalData = {
        name: 'Email Test Hospital',
        type: 'general',
        address: {
          street: '123 Main St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94112345678',
          email: 'invalid-email',
        },
      };

      await expect(Hospital.create(hospitalData)).rejects.toThrow();
    });
  });

  describe('Departments and Facilities', () => {
    it('should store departments', async () => {
      const hospital = await Hospital.create({
        name: 'Multi-Department Hospital',
        type: 'general',
        address: {
          street: '789 Medical Plaza',
          city: 'Galle',
          zipCode: '80000',
        },
        contactInfo: {
          phone: '+94912345678',
          email: 'info@mdh.lk',
        },
        departments: ['Cardiology', 'Neurology', 'Pediatrics', 'Surgery'],
      });

      expect(hospital.departments).toHaveLength(4);
      expect(hospital.departments).toContain('Cardiology');
      expect(hospital.departments).toContain('Pediatrics');
    });

    it('should store facilities', async () => {
      const hospital = await Hospital.create({
        name: 'Modern Hospital',
        type: 'specialized',
        address: {
          street: '321 Health Street',
          city: 'Jaffna',
          zipCode: '40000',
        },
        contactInfo: {
          phone: '+94212345678',
          email: 'info@modern.lk',
        },
        facilities: ['ICU', 'Emergency Room', 'Operating Theaters', 'Laboratory', 'Pharmacy'],
      });

      expect(hospital.facilities).toHaveLength(5);
      expect(hospital.facilities).toContain('ICU');
      expect(hospital.facilities).toContain('Laboratory');
    });

    it('should store specializations for specialized hospitals', async () => {
      const hospital = await Hospital.create({
        name: 'Heart Center',
        type: 'specialized',
        address: {
          street: '555 Cardiac Way',
          city: 'Colombo',
          zipCode: '10500',
        },
        contactInfo: {
          phone: '+94115555555',
          email: 'info@heartcenter.lk',
        },
        specializations: ['Cardiac Surgery', 'Interventional Cardiology', 'Electrophysiology'],
      });

      expect(hospital.specializations).toHaveLength(3);
      expect(hospital.specializations).toContain('Cardiac Surgery');
    });
  });

  describe('Bed Information', () => {
    it('should store bed capacity information', async () => {
      const hospital = await Hospital.create({
        name: 'Large Hospital',
        type: 'general',
        address: {
          street: '100 Hospital Road',
          city: 'Colombo',
          zipCode: '10100',
        },
        contactInfo: {
          phone: '+94117777777',
          email: 'info@large.lk',
        },
        bedCapacity: {
          total: 500,
          available: 150,
          icu: 50,
          emergency: 30,
        },
      });

      expect(hospital.bedCapacity.total).toBe(500);
      expect(hospital.bedCapacity.available).toBe(150);
      expect(hospital.bedCapacity.icu).toBe(50);
      expect(hospital.bedCapacity.emergency).toBe(30);
    });
  });

  describe('Operating Hours', () => {
    it('should store operating hours', async () => {
      const hospital = await Hospital.create({
        name: '24/7 Hospital',
        type: 'general',
        address: {
          street: '777 Always Open Ave',
          city: 'Colombo',
          zipCode: '10200',
        },
        contactInfo: {
          phone: '+94118888888',
          email: 'info@247.lk',
        },
        operatingHours: {
          monday: { open: '00:00', close: '23:59' },
          tuesday: { open: '00:00', close: '23:59' },
          wednesday: { open: '00:00', close: '23:59' },
          thursday: { open: '00:00', close: '23:59' },
          friday: { open: '00:00', close: '23:59' },
          saturday: { open: '00:00', close: '23:59' },
          sunday: { open: '00:00', close: '23:59' },
        },
      });

      expect(hospital.operatingHours.monday.open).toBe('00:00');
      expect(hospital.operatingHours.sunday.close).toBe('23:59');
    });

    it('should handle partial week operating hours', async () => {
      const hospital = await Hospital.create({
        name: 'Clinic Hospital',
        type: 'clinic',
        address: {
          street: '999 Clinic Lane',
          city: 'Colombo',
          zipCode: '10300',
        },
        contactInfo: {
          phone: '+94119999999',
          email: 'info@clinic.lk',
        },
        operatingHours: {
          monday: { open: '08:00', close: '17:00' },
          tuesday: { open: '08:00', close: '17:00' },
          wednesday: { open: '08:00', close: '17:00' },
          thursday: { open: '08:00', close: '17:00' },
          friday: { open: '08:00', close: '17:00' },
        },
      });

      expect(hospital.operatingHours.monday.open).toBe('08:00');
      expect(hospital.operatingHours.friday.close).toBe('17:00');
    });
  });

  describe('Insurance and Accreditation', () => {
    it('should store accepted insurance providers', async () => {
      const hospital = await Hospital.create({
        name: 'Insurance Friendly Hospital',
        type: 'general',
        address: {
          street: '123 Insurance St',
          city: 'Colombo',
          zipCode: '10400',
        },
        contactInfo: {
          phone: '+94111111111',
          email: 'info@insurance.lk',
        },
        insuranceAccepted: ['Ceylinco', 'AIA', 'Union Assurance', 'Allianz'],
      });

      expect(hospital.insuranceAccepted).toHaveLength(4);
      expect(hospital.insuranceAccepted).toContain('Ceylinco');
    });

    it('should store accreditation details', async () => {
      const hospital = await Hospital.create({
        name: 'Accredited Hospital',
        type: 'general',
        address: {
          street: '456 Quality Road',
          city: 'Colombo',
          zipCode: '10500',
        },
        contactInfo: {
          phone: '+94112222222',
          email: 'info@accredited.lk',
        },
        accreditation: {
          isAccredited: true,
          accreditingBody: 'JCI',
          accreditationDate: new Date('2022-01-01'),
          expiryDate: new Date('2025-01-01'),
        },
      });

      expect(hospital.accreditation.isAccredited).toBe(true);
      expect(hospital.accreditation.accreditingBody).toBe('JCI');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long hospital names', async () => {
      const longName = 'The ' + 'Very '.repeat(20) + 'Long Hospital Name';
      const hospital = await Hospital.create({
        name: longName,
        type: 'general',
        address: {
          street: '123 Test St',
          city: 'Colombo',
          zipCode: '10000',
        },
        contactInfo: {
          phone: '+94113333333',
          email: 'test@long.lk',
        },
      });

      expect(hospital.name).toBe(longName);
    });

    it('should handle many departments', async () => {
      const departments = Array(50).fill(null).map((_, i) => `Department ${i + 1}`);
      const hospital = await Hospital.create({
        name: 'Multi-Department Complex',
        type: 'general',
        address: {
          street: '789 Complex Ave',
          city: 'Colombo',
          zipCode: '10600',
        },
        contactInfo: {
          phone: '+94114444444',
          email: 'info@complex.lk',
        },
        departments,
      });

      expect(hospital.departments).toHaveLength(50);
    });

    it('should handle hospitals with minimal information', async () => {
      const hospital = await Hospital.create({
        name: 'Minimal Hospital',
        type: 'clinic',
        address: {
          street: '1 Simple St',
          city: 'Town',
          zipCode: '00000',
        },
        contactInfo: {
          phone: '+94115555555',
          email: 'min@test.lk',
        },
      });

      expect(hospital.name).toBe('Minimal Hospital');
      expect(hospital.departments).toBeUndefined();
      expect(hospital.facilities).toBeUndefined();
    });
  });

  describe('Hospital Status', () => {
    it('should allow toggling active status', async () => {
      const hospital = await Hospital.create({
        name: 'Toggle Hospital',
        type: 'general',
        address: {
          street: '321 Toggle Ave',
          city: 'Colombo',
          zipCode: '10700',
        },
        contactInfo: {
          phone: '+94116666666',
          email: 'info@toggle.lk',
        },
      });

      expect(hospital.isActive).toBe(true);

      hospital.isActive = false;
      await hospital.save();

      const updated = await Hospital.findById(hospital._id);
      expect(updated.isActive).toBe(false);
    });
  });
});

