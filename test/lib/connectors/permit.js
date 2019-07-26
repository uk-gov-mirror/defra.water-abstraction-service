const { expect } = require('@hapi/code');
const {
  beforeEach,
  afterEach,
  experiment,
  test } = exports.lab = require('@hapi/lab').script();

const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const permit = require('../../../src/lib/connectors/permit');
const { serviceRequest } = require('@envage/water-abstraction-helpers');

const { licence: { regimeId, typeId } } = require('../../../config');

experiment('connectors/permit', () => {
  beforeEach(async () => {
    sandbox.stub(serviceRequest, 'get').resolves({
      version: '0.0.1'
    });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('getLicenceRegionCodes', () => {
    const licenceNumbers = ['05/678', '06/890'];

    beforeEach(async () => {
      sandbox.stub(permit.licences, 'findAll').resolves([
        { licence_ref: '05/678', '?column?': '1' },
        { licence_ref: '06/890', '?column?': '2' }
      ]);
    });

    test('calls the permit API with correct arguments', async () => {
      await permit.getLicenceRegionCodes(licenceNumbers);

      const [filter, sort, columns] = permit.licences.findAll.firstCall.args;

      expect(filter).to.equal({
        licence_regime_id: 1,
        licence_type_id: 8,
        licence_ref: {
          $in: licenceNumbers
        }
      });

      expect(sort).to.equal(null);

      expect(columns).to.equal(['licence_ref', 'licence_data_value->>FGAC_REGION_CODE']);
    });

    test('resolves with a map of licence numbers / region codes', async () => {
      const result = await permit.getLicenceRegionCodes(licenceNumbers);
      expect(result).to.equal({
        '05/678': 1,
        '06/890': 2
      });
    });

    test('resolves with an empty object if no licence numbers supplied', async () => {
      const result = await permit.getLicenceRegionCodes([]);
      expect(result).to.equal({});
    });
  });

  experiment('getLicenceEndDates', () => {
    const licenceNumbers = ['l-1', 'l-2'];

    beforeEach(async () => {
      sandbox.stub(permit.licences, 'findAll').resolves([
        {
          licence_ref: 'l-1',
          licence_data_value: {
            REV_DATE: 'null',
            EXPIRY_DATE: '01/01/2001',
            LAPSED_DATE: 'null'
          }
        },
        {
          licence_ref: 'l-2',
          licence_data_value: {
            REV_DATE: '01/01/2001',
            EXPIRY_DATE: 'null',
            LAPSED_DATE: '02/02/2002'
          }
        }
      ]);
    });

    afterEach(async () => {
      sandbox.restore();
    });

    test('calls the permit API with correct arguments', async () => {
      await permit.getLicenceEndDates(licenceNumbers);

      const [filter, sort, columns] = permit.licences.findAll.firstCall.args;

      expect(filter).to.equal({
        licence_regime_id: 1,
        licence_type_id: 8,
        licence_ref: {
          $in: licenceNumbers
        }
      });

      expect(sort).to.equal(null);

      expect(columns).to.equal(['licence_ref', 'licence_data_value']);
    });

    test('resolves with a map of licence numbers / end dates', async () => {
      const result = await permit.getLicenceEndDates(licenceNumbers);
      expect(result).to.equal({
        'l-1': {
          dateRevoked: null,
          dateExpired: '2001-01-01',
          dateLapsed: null
        },
        'l-2': {
          dateRevoked: '2001-01-01',
          dateExpired: null,
          dateLapsed: '2002-02-02'
        }
      });
    });

    test('resolves with an empty object if no licence numbers supplied', async () => {
      const result = await permit.getLicenceEndDates([]);
      expect(result).to.equal({});
    });
  });

  experiment('getWaterLicence', () => {
    const licenceNumber = '05/678';

    beforeEach(async () => {
      sandbox.stub(permit.licences, 'findMany').resolves({
        data: [{ licence_ref: licenceNumber }]
      });
    });

    afterEach(async () => {
      sandbox.restore();
    });

    test('should find licence with correct regime, type and ID', async () => {
      await permit.licences.getWaterLicence(licenceNumber);
      const [ filter ] = permit.licences.findMany.lastCall.args;
      expect(filter.licence_regime_id).to.equal(regimeId);
      expect(filter.licence_type_id).to.equal(typeId);
      expect(filter.licence_ref).to.equal(licenceNumber);
    });

    test('should return the first result found', async () => {
      const result = await permit.licences.getWaterLicence(licenceNumber);
      expect(result.licence_ref).to.equal(licenceNumber);
    });
  });

  experiment('.getServiceVersion', () => {
    test('calls the expected URL', async () => {
      await permit.getServiceVersion();
      const [url] = serviceRequest.get.lastCall.args;
      expect(url).to.endWith('/status');
    });
  });
});
