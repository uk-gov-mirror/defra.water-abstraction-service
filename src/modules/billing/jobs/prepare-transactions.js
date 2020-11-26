'use strict';

const { get, partial } = require('lodash');

const JOB_NAME = 'billing.prepare-transactions';

const batchService = require('../services/batch-service');
const { BATCH_ERROR_CODE, BATCH_STATUS } = require('../../../lib/models/batch');
const batchJob = require('./lib/batch-job');
const helpers = require('./lib/helpers');
const { jobName: createChargeJobName } = require('./create-charge');
const { logger } = require('../../../logger');
const supplementaryBillingService = require('../services/supplementary-billing-service');
const billingTransactionsRepo = require('../../../lib/connectors/repos/billing-transactions');

const createMessage = partial(helpers.createMessage, JOB_NAME);

const handler = async job => {
  batchJob.logHandling(job);

  const batchId = get(job, 'data.batchId');

  try {
    const batch = await batchService.getBatchById(batchId);

    // Supplementary processing handles credits/charges
    if (batch.isSupplementary()) {
      logger.info(`Processing supplementary transactions ${job.name}`);
      await supplementaryBillingService.processBatch(batch.id);
    }

    // Get all transactions now in batch
    const transactions = await billingTransactionsRepo.findByBatchId(batch.id);

    // Set empty batch
    if (transactions.length === 0) {
      logger.info(`No transactions produced for batch ${batchId}, finalising batch run`);
      const updatedBatch = await batchService.setStatus(batchId, BATCH_STATUS.empty);
      return { batch: updatedBatch, transactions };
    }

    return {
      batch,
      transactions
    };
  } catch (err) {
    await batchJob.logHandlingErrorAndSetBatchStatus(job, err, BATCH_ERROR_CODE.failedToPrepareTransactions);
    throw err;
  }
};

const onComplete = async (job, queueManager) => {
  try {
    const { transactions, batch } = job.returnvalue;
    const batchId = batch.id;

    logger.info(`${transactions.length} transactions produced for batch ${batchId}, creating charges...`);

    // Note: publish jobs in series to avoid overwhelming message queue
    for (const transaction of transactions) {
      await queueManager.add(createChargeJobName, batchId, transaction.billingTransactionId);
    }
  } catch (err) {
    batchJob.logOnCompleteError(job, err);
  }
};

exports.jobName = JOB_NAME;
exports.createMessage = createMessage;
exports.handler = handler;
exports.onComplete = onComplete;
exports.onFailed = helpers.onFailedHandler;
