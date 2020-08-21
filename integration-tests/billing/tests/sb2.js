'use strict';

const { expect } = require('@hapi/code');
const { omit } = require('lodash');

const {
  experiment,
  test,
  before,
  beforeEach,
  after
} = exports.lab = require('@hapi/lab').script();

const services = require('../services');
const chargeModuleTransactionsService = require('../services/charge-module-transactions');
const transactionTests = require('./transaction-tests');

experiment('sb2 - increased authorised volume in current year', () => {
  let annualBatch;
  let supplementaryBatch;
  let supplementaryChargeModuleTransactions;

  before(async () => {
    await services.tearDown.tearDown();
    console.log('tear down complete');

    console.log('creating annual batch');
    annualBatch = await services.scenarios.runScenario({
      licence: 'l2',
      chargeVersions: [{
        company: 'co1',
        invoiceAccount: 'ia1',
        chargeVersion: 'cv1',
        chargeElements: ['ce2']
      }]
    }, 'annual');

    // mark the annual batch as sent so a new batch for the same
    // region can be created
    await services.batches.updateStatus(annualBatch, 'sent');

    // mark the existing charge version as superseded so the new
    // charge version is the current one.
    await services.chargeVersions.updateStatus('superseded');

    console.log('creating supplementary batch');
    supplementaryBatch = await services.scenarios.runScenario({
      licence: 'l2',
      chargeVersions: [{
        company: 'co1',
        invoiceAccount: 'ia1',
        chargeVersion: 'cv3',
        chargeElements: ['ce3']
      }]
    }, 'supplementary');

    supplementaryChargeModuleTransactions = await chargeModuleTransactionsService.getTransactionsForBatch(supplementaryBatch);

    console.log('suppl', supplementaryChargeModuleTransactions);
  });

  experiment('has expected batch details', () => {
    test('the batch is "supplementary"', async () => {
      expect(supplementaryBatch.batchType).to.equal('supplementary');
    });

    test('the batch has the correct financial year range', async () => {
      expect(supplementaryBatch.fromFinancialYearEnding).to.equal(2019);
      expect(supplementaryBatch.toFinancialYearEnding).to.equal(2020);
    });

    test('the batch is in "ready" status', async () => {
      expect(supplementaryBatch.status).to.equal('ready');
    });

    test('the batch has been created in the charge module', async () => {
      expect(supplementaryBatch.billRunNumber).to.be.a.number();
      expect(supplementaryBatch.externalId).to.be.a.string().length(36);
    });

    test('no error codes are generated', async () => {
      expect(supplementaryBatch.errorCode).to.equal(null);
    });
  });

  after(async () => {
    await services.tearDown.tearDown(annualBatch, supplementaryBatch);
  });
});
