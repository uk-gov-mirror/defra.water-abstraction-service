'use strict';

const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const uuid = require('uuid/v4');
const { expect } = require('@hapi/code');

const sandbox = require('sinon').createSandbox();

const { NotFoundError, InvalidEntityError } = require('../../../../src/lib/errors');
const { logger } = require('../../../../src/logger');

// Repos
const chargeVersionWorkflowRepo = require('../../../../src/lib/connectors/repos/charge-version-workflows');

// Services
const chargeVersionWorkflowService = require('../../../../src/modules/charge-versions/services/charge-version-workflows');
const documentsService = require('../../../../src/lib/services/documents-service');
const service = require('../../../../src/lib/services/service');
const chargeVersionService = require('../../../../src/lib/services/charge-versions');

// Models
const ChargeVersionWorkflow = require('../../../../src/lib/models/charge-version-workflow');
const Document = require('../../../../src/lib/models/document');
const DateRange = require('../../../../src/lib/models/date-range');
const Role = require('../../../../src/lib/models/role');
const Licence = require('../../../../src/lib/models/licence');
const ChargeVersion = require('../../../../src/lib/models/charge-version');
const ChargeVersionWorflow = require('../../../../src/lib/models/charge-version-workflow');
const User = require('../../../../src/lib/models/user');

// Mappers
const chargeVersionWorkflowMapper = require('../../../../src/lib/mappers/charge-version-workflow');

const roleId = uuid();

const createChargeVersionWorkflow = () => {
  const chargeVersion = new ChargeVersion();
  chargeVersion.dateRange = new DateRange('2019-01-01', null);

  const licence = new Licence();
  licence.licenceNumber = '01/123/ABC';

  const chargeVersionWorkflow = new ChargeVersionWorkflow(uuid());
  return chargeVersionWorkflow.fromHash({
    chargeVersion,
    licence
  });
};

const createDocument = () => {
  const doc = new Document();
  sandbox.stub(doc, 'getRoleOnDate').returns(
    new Role(roleId)
  );
  return doc;
};

experiment('modules/charge-versions/services/charge-version-workflows', () => {
  let chargeVersionWorkflow, result;

  beforeEach(async () => {
    chargeVersionWorkflow = createChargeVersionWorkflow();

    sandbox.stub(documentsService, 'getValidDocumentOnDate').resolves(
      createDocument()
    );

    sandbox.stub(service, 'findAll').resolves([chargeVersionWorkflow]);
    sandbox.stub(service, 'findOne').resolves(chargeVersionWorkflow);
    sandbox.stub(service, 'findMany').resolves([chargeVersionWorkflow]);

    sandbox.stub(chargeVersionWorkflowRepo, 'create');
    sandbox.stub(chargeVersionWorkflowRepo, 'update');
    sandbox.stub(chargeVersionWorkflowRepo, 'deleteOne');

    sandbox.stub(chargeVersionService, 'create');

    sandbox.stub(logger, 'error');
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.getAll', () => {
    beforeEach(async () => {
      result = await chargeVersionWorkflowService.getAll();
    });

    test('delegates to service.findAll', async () => {
      const [fetchDataFunc, mapper] = service.findAll.lastCall.args;
      expect(fetchDataFunc).to.equal(chargeVersionWorkflowRepo.findAll);
      expect(mapper).to.equal(chargeVersionWorkflowMapper);
    });

    test('resolves with an array of ChargeVersionWorkflow models', async () => {
      expect(result).to.be.an.array().length(1);
      expect(result[0]).to.equal(chargeVersionWorkflow);
    });
  });

  experiment('.getAllWithLicenceHolder', () => {
    beforeEach(async () => {
      result = await chargeVersionWorkflowService.getAllWithLicenceHolder();
    });

    test('delegates to service.findAll', async () => {
      const [fetchDataFunc, mapper] = service.findAll.lastCall.args;
      expect(fetchDataFunc).to.equal(chargeVersionWorkflowRepo.findAll);
      expect(mapper).to.equal(chargeVersionWorkflowMapper);
    });

    test('finds document with licence number and date', async () => {
      expect(documentsService.getValidDocumentOnDate.calledWith(
        '01/123/ABC', '2019-01-01'
      )).to.be.true();
    });

    test('resolves with an array of objects each with a chargeVersionWorkflow and licenceHolderRole', async () => {
      expect(result).to.be.an.array().length(1);
      expect(result[0].chargeVersionWorkflow).to.equal(chargeVersionWorkflow);
      expect(result[0].licenceHolderRole.id).to.equal(roleId);
    });
  });

  experiment('.getById', () => {
    beforeEach(async () => {
      result = await chargeVersionWorkflowService.getById('test-id');
    });

    test('delegates to service.findOne', async () => {
      const [id, fetchDataFunc, mapper] = service.findOne.lastCall.args;
      expect(id).to.equal('test-id');
      expect(fetchDataFunc).to.equal(chargeVersionWorkflowRepo.findOne);
      expect(mapper).to.equal(chargeVersionWorkflowMapper);
    });

    test('resolves with an array of ChargeVersionWorkflow models', async () => {
      expect(result).to.equal(chargeVersionWorkflow);
    });
  });

  experiment('.getByIdWithLicenceHolder', () => {
    experiment('when the charge version workflow is found', () => {
      beforeEach(async () => {
        result = await chargeVersionWorkflowService.getByIdWithLicenceHolder('test-id');
      });

      test('delegates to service.findOne', async () => {
        const [id, fetchDataFunc, mapper] = service.findOne.lastCall.args;
        expect(id).to.equal('test-id');
        expect(fetchDataFunc).to.equal(chargeVersionWorkflowRepo.findOne);
        expect(mapper).to.equal(chargeVersionWorkflowMapper);
      });

      test('finds document with licence number and date', async () => {
        expect(documentsService.getValidDocumentOnDate.calledWith(
          '01/123/ABC', '2019-01-01'
        )).to.be.true();
      });

      test('resolves with an object with a chargeVersionWorkflow and licenceHolderRole', async () => {
        expect(result).to.be.an.object();
        expect(result.chargeVersionWorkflow).to.equal(chargeVersionWorkflow);
        expect(result.licenceHolderRole.id).to.equal(roleId);
      });
    });

    experiment('when the charge version workflow is not found', () => {
      beforeEach(async () => {
        service.findOne.resolves(undefined);
        result = await chargeVersionWorkflowService.getByIdWithLicenceHolder('test-id');
      });

      test('resolves with undefined', async () => {
        expect(result).to.be.undefined();
      });
    });
  });

  experiment('.getManyByLicenceId', () => {
    beforeEach(async () => {
      result = await chargeVersionWorkflowService.getManyByLicenceId('test-id');
    });

    test('delegates to service.findMany', async () => {
      const [id, fetchDataFunc, mapper] = service.findMany.lastCall.args;
      expect(id).to.equal('test-id');
      expect(fetchDataFunc).to.equal(chargeVersionWorkflowRepo.findManyForLicence);
      expect(mapper).to.equal(chargeVersionWorkflowMapper);
    });

    test('resolves with an array of ChargeVersionWorkflow models', async () => {
      expect(result).to.equal([chargeVersionWorkflow]);
    });
  });

  experiment('.create', () => {
    let licence, chargeVersion, user;
    const chargeVersionWorkflowId = uuid();

    beforeEach(async () => {
      licence = new Licence(uuid());
      chargeVersion = new ChargeVersion();
      chargeVersion.dateRange = new DateRange('2019-01-01', null);
      user = new User(123, 'mail@example.com');
    });

    experiment('when the charge version workflow data is valid', () => {
      beforeEach(async () => {
        chargeVersionWorkflowRepo.create.resolves({
          chargeVersionWorkflowId,
          data: {
            chargeVersion: {
              dateRange: {
                startDate: '2019-01-01',
                endDate: null
              }
            }
          }

        });

        result = await chargeVersionWorkflowService.create(licence, chargeVersion, user);
      });

      test('the charge version workflow data is persisted in the repo', async () => {
        const [data] = chargeVersionWorkflowRepo.create.lastCall.args;

        expect(data.licenceId).to.equal(licence.id);
        expect(data.status).to.equal('review');
        expect(data.createdBy).to.equal({
          id: 123,
          email: 'mail@example.com'
        });
        expect(data.data.chargeVersion).to.equal({
          chargeElements: [],
          dateRange: {
            startDate: '2019-01-01',
            endDate: null
          }
        });
      });

      test('resolves with a ChargeVersionWorkflow model', async () => {
        expect(result).to.be.an.instanceof(ChargeVersionWorflow);
        expect(result.id).to.equal(chargeVersionWorkflowId);
      });
    });

    experiment('when an invalid model is supplied', async () => {
      test('a validation error is thrown', async () => {
        const func = () => chargeVersionWorkflowService.create(licence, licence, user);
        expect(func()).to.reject();
        expect(chargeVersionWorkflowRepo.create.called).to.be.false();
      });
    });
  });

  experiment('.update', () => {
    const id = uuid();

    beforeEach(async () => {
      const model = new ChargeVersionWorkflow(id);
      model.licence = new Licence(uuid());
      model.createdBy = new User(123, 'mail@example.com');
      model.chargeVersion = new ChargeVersion();

      service.findOne.resolves(model);

      chargeVersionWorkflowRepo.update.resolves({
        chargeVersionWorkflowId: id,
        status: 'review',
        data: {
          chargeVersion: {
            dateRange: {
              startDate: '2019-01-01',
              endDate: null
            }
          }
        }
      });
    });

    experiment('if the charge version workflow is not found', () => {
      beforeEach(async () => {
        service.findOne.resolves(null);
      });

      test('a NotFoundError is thrown', async () => {
        const func = () => chargeVersionWorkflowService.update(id, { status: 'review' });
        const err = await expect(func()).to.reject();
        expect(err).to.be.an.instanceof(NotFoundError);
        expect(err.message).to.equal(`Charge version workflow ${id} not found`);
      });
    });

    experiment('if the supplied changes are invalid', () => {
      test('an InvalidEntityError is thrown', async () => {
        const func = () => chargeVersionWorkflowService.update(id, { status: 'invalid-status' });
        const err = await expect(func()).to.reject();
        expect(err).to.be.an.instanceof(InvalidEntityError);
        expect(err.message).to.equal(`Invalid data for charge version workflow ${id}`);
      });
    });

    experiment('if the supplied changes are valid', () => {
      beforeEach(async () => {
        result = await chargeVersionWorkflowService.update(id, { status: 'review' });
      });

      test('the charge version workflow is loaded by id', async () => {
        expect(service.findOne.calledWith(id)).to.be.true();
      });

      test('the model is mapped to a plain object for persisting', async () => {
        const [updatedId, dbRow] = chargeVersionWorkflowRepo.update.lastCall.args;
        expect(updatedId).to.equal(id);
        expect(dbRow).to.be.an.object();
        expect(dbRow.chargeVersionWorkflowId).to.equal(id);
        expect(dbRow.status).to.equal('review');
      });
    });
  });

  experiment('.delete', () => {
    const id = uuid();

    test('calls the repo .deleteOne method', async () => {
      await chargeVersionWorkflowService.delete(id);
      expect(chargeVersionWorkflowRepo.deleteOne.calledWith(id)).to.be.true();
    });

    test('if there is an error, catches and rethrows a NotFoundError', async () => {
      chargeVersionWorkflowRepo.deleteOne.throws(new Error('oh no!'));
      const func = () => chargeVersionWorkflowService.delete(id);
      const err = await expect(func()).to.reject();
      expect(err).to.be.an.instanceof(NotFoundError);
    });
  });

  experiment('.approve', () => {
    let approvingUser, chargeVersionWorkflow;

    beforeEach(async () => {
      approvingUser = new User(123, 'mail@example.com');
      chargeVersionWorkflow = new ChargeVersionWorkflow(uuid());
      chargeVersionWorkflow.fromHash({
        chargeVersion: new ChargeVersion(uuid()),
        createdBy: new User(456, 'someone-else@example.com')
      });
      chargeVersionWorkflow.chargeVersion = new ChargeVersion(uuid());
      await chargeVersionWorkflowService.approve(chargeVersionWorkflow, approvingUser);
    });

    test('the new charge version is persisted', async () => {
      expect(chargeVersionService.create.calledWith(
        chargeVersionWorkflow.chargeVersion
      )).to.be.true();
    });

    test('the approver of the new charge version is set', async () => {
      const [chargeVersion] = chargeVersionService.create.lastCall.args;
      expect(chargeVersion.approvedBy).to.equal(approvingUser);
    });

    test('the workflow record is deleted', async () => {
      expect(chargeVersionWorkflowRepo.deleteOne.calledWith(chargeVersionWorkflow.id)).to.be.true();
    });
  });

  experiment('getLicenceHolderRole', () => {
    experiment('when no document is found for the licence and start date', () => {
      beforeEach(async () => {
        documentsService.getValidDocumentOnDate.resolves(null);
      });

      test('a response is returned with a blank role object', async () => {
        const licenceObject = {
          licenceNumber: '123'
        };

        const chargeVersionObject = {
          dateRange: {
            startDate: '2000-01-01'
          }
        };

        result = await chargeVersionWorkflowService.getLicenceHolderRole({
          licence: licenceObject,
          chargeVersion: chargeVersionObject
        });

        expect(result.chargeVersionWorkflow.licence).to.equal(licenceObject);
        expect(result.chargeVersionWorkflow.chargeVersion).to.equal(chargeVersionObject);
        expect(result.licenceHolderRole).to.equal({});
      });
    });
  });
});
