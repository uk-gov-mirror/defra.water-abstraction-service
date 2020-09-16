const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const { expect } = require('@hapi/code');
const sandbox = require('sinon').createSandbox();
const uuid = require('uuid/v4');

const processChargeVersion = require('../../../../src/modules/billing/jobs/process-charge-version');
const chargeVersionYearService = require('../../../../src/modules/billing/services/charge-version-year');
const batchService = require('../../../../src/modules/billing/services/batch-service');

const batchJob = require('../../../../src/modules/billing/jobs/lib/batch-job');

const { Batch } = require('../../../../src/lib/models');

const eventId = '00000000-0000-0000-0000-000000000000';
const BATCH_ID = uuid();

experiment('modules/billing/jobs/process-charge-version', () => {
  let batch;

  beforeEach(async () => {
    sandbox.stub(batchJob, 'logHandling');
    sandbox.stub(batchJob, 'logHandlingError');

    batch = new Batch(BATCH_ID);

    sandbox.stub(batchService, 'saveInvoicesToDB');
    sandbox.stub(batchService, 'setErrorStatus');

    sandbox.stub(chargeVersionYearService, 'processChargeVersionYear').resolves(batch);
    sandbox.stub(chargeVersionYearService, 'setErrorStatus').resolves();
    sandbox.stub(chargeVersionYearService, 'setReadyStatus').resolves();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  test('exports the expected job name', async () => {
    expect(processChargeVersion.jobName).to.equal('billing.process-charge-version.*');
  });

  experiment('.createMessage', () => {
    let message;
    let chargeVersionYear;
    let batch;

    beforeEach(async () => {
      chargeVersionYear = { billing_batch_charge_version_year_id: 1 };
      batch = { id: BATCH_ID };
      message = processChargeVersion.createMessage('test-event-id', chargeVersionYear, batch);
    });

    test('using the expected job name', async () => {
      expect(message.name).to.equal(`billing.process-charge-version.${BATCH_ID}`);
    });

    test('includes a data object with the batch', async () => {
      expect(message.data.batch).to.equal(batch);
    });

    test('includes a data object with the event id', async () => {
      expect(message.data.eventId).to.equal('test-event-id');
    });

    test('includes a data object with the charge version year data', async () => {
      expect(message.data.chargeVersionYear.billing_batch_charge_version_year_id).to.equal(1);
    });
  });

  experiment('.handler', () => {
    let result, job, chargeVersionYear;

    beforeEach(async () => {
      chargeVersionYear = {
        billingBatchChargeVersionYearId: 'test-id',
        chargeVersionId: 'charge_verion_id',
        financialYearEnding: 2020,
        billingBatchId: BATCH_ID
      };

      job = {
        data: {
          eventId,
          chargeVersionYear,
          batch: { id: BATCH_ID }
        }
      };

      result = await processChargeVersion.handler(job);
    });

    test('a message is logged', async () => {
      const errorArgs = batchJob.logHandling.lastCall.args;
      expect(errorArgs[0]).to.equal(job);
    });

    test('resolves including the chargeVersionYear', async () => {
      expect(result.chargeVersionYear.billingBatchChargeVersionYearId).to.equal('test-id');
    });

    test('resolves including the batch details', async () => {
      expect(result.batch.id).to.equal(BATCH_ID);
    });

    experiment('when there are no errors', () => {
      beforeEach(async () => {
        await processChargeVersion.handler(job);
      });

      test('a batch model is created from the charge version year', async () => {
        expect(chargeVersionYearService.processChargeVersionYear.calledWith(
          chargeVersionYear
        )).to.be.true();
      });

      test('the batch model is persisted', async () => {
        expect(batchService.saveInvoicesToDB.calledWith(
          batch
        )).to.be.true();
      });

      test('the billing batch charge version year status is updated to "ready"', async () => {
        expect(chargeVersionYearService.setReadyStatus.calledWith(
          chargeVersionYear.billingBatchChargeVersionYearId
        )).to.be.true();
      });
    });

    experiment('when there is an error', () => {
      let error;
      beforeEach(async () => {
        error = new Error('oops');
        chargeVersionYearService.setReadyStatus.rejects(error);
        const func = () => processChargeVersion.handler(job);
        await expect(func()).to.reject();
      });

      test('a message is logged', async () => {
        const errorArgs = batchJob.logHandlingError.lastCall.args;
        expect(errorArgs[0]).to.equal(job);
        expect(errorArgs[1]).to.equal(error);
      });

      test('the batch is marked as error', async () => {
        expect(batchService.setErrorStatus.calledWith(
          BATCH_ID, Batch.BATCH_ERROR_CODE.failedToProcessChargeVersions
        )).to.be.true();
      });

      test('the billing batch charge version year status is updated to "error"', async () => {
        expect(chargeVersionYearService.setErrorStatus.calledWith(
          chargeVersionYear.billingBatchChargeVersionYearId
        )).to.be.true();
      });
    });
  });
});
