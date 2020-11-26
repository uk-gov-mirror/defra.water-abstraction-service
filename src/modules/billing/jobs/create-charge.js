'use strict';

const { get } = require('lodash');

const JOB_NAME = 'billing.create-charge';

const batchService = require('../services/batch-service');
const { BATCH_ERROR_CODE, BATCH_STATUS } = require('../../../lib/models/batch');
const batchJob = require('./lib/batch-job');
const helpers = require('./lib/helpers');
const transactionsService = require('../services/transactions-service');
const chargeModuleBillRunConnector = require('../../../lib/connectors/charge-module/bill-runs');
const batchMapper = require('../mappers/batch');
const Transaction = require('../../../lib/models/transaction');
const { jobName: refreshTotalsJobName } = require('./refresh-totals');
const config = require('../../../../config');

const workerOptions = {
  concurrency: config.billing.createChargeJobConcurrency
};

const createMessage = (batchId, billingBatchTransactionId) => ([
  JOB_NAME,
  {
    batchId,
    billingBatchTransactionId
  },
  {
    jobId: `${JOB_NAME}.${batchId}.${billingBatchTransactionId}`
  }
]);

/**
 * Checks if the error is an HTTP client error (in range 400 - 499)
 * @param {Error} err
 * @return {Boolean}
 */
const isClientError = err => {
  const statusCode = get(err, 'statusCode', 0);
  return (statusCode >= 400) && (statusCode < 500);
};

const updateBatchState = async batch => {
  const statuses = await batchService.getTransactionStatusCounts(batch.id);
  const flags = {
    isReady: get(statuses, Transaction.statuses.candidate, 0) === 0,
    isEmptyBatch: get(statuses, Transaction.statuses.chargeCreated, 0) === 0
  };

  if (flags.isReady) {
    // Clean up batch
    await batchService.cleanup(batch.id);

    // Set batch status to empty for empty batch
    if (flags.isEmptyBatch) {
      await batchService.setStatus(batch.id, BATCH_STATUS.empty);
    }
  }

  return flags;
};

const handler = async job => {
  batchJob.logHandling(job);

  const transactionId = get(job, 'data.billingBatchTransactionId');
  const batchId = get(job, 'data.batchId');

  try {
    // Create batch model from loaded data
    const batch = await transactionsService.getById(transactionId);

    // Map data to charge module transaction
    const [cmTransaction] = batchMapper.modelToChargeModule(batch);

    // Create transaction in Charge Module
    const response = await chargeModuleBillRunConnector.addTransaction(batch.externalId, cmTransaction);

    // Update/remove our local transaction in water.billing_transactions
    await transactionsService.updateWithChargeModuleResponse(transactionId, response);

    // Note: the await is needed to ensure any error is handled here
    return await updateBatchState(batch);
  } catch (err) {
    // Always log and mark transaction as errored in DB
    transactionsService.setErrorStatus(transactionId);
    batchJob.logHandlingError(job, err);

    // If not a client error, error the batch
    if (!isClientError(err)) {
      await batchService.setErrorStatus(batchId, BATCH_ERROR_CODE.failedToCreateCharge);
      throw err;
    }
  }

  return {
    batch: job.data.batch
  };
};

const onComplete = async (job, queueManager) => {
  batchJob.logOnComplete(job);

  try {
    const { batchId } = job.data;
    const { isReady, isEmptyBatch } = job.returnvalue;

    if (isReady && !isEmptyBatch) {
      await queueManager.add(refreshTotalsJobName, batchId);
    }
  } catch (err) {
    batchJob.logOnCompleteError(job, err);
  }
};

exports.handler = handler;
exports.onComplete = onComplete;
exports.onFailed = helpers.onFailedHandler;
exports.jobName = JOB_NAME;
exports.createMessage = createMessage;
exports.workerOptions = workerOptions;
