'use strict';
const { get, partial } = require('lodash');
const { updateCustomer } = require('../../../lib/connectors/charge-module/customers');
const JOB_NAME = 'billing.update-customer-account';
const invoiceAccountsConnector = require('../../../lib/connectors/crm-v2/invoice-accounts');
const chargeModuleMappers = require('../../../lib/mappers/charge-module');
const { logger } = require('../../../logger');
const uuid = require('uuid/v4');

const messageInitialiser = (jobName, invoiceAccountId) => ([
  JOB_NAME,
  {
    invoiceAccountId
  },
  {
    singletonKey: `${JOB_NAME}.${invoiceAccountId}.${uuid()}`,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true
  }
]);

const createMessage = partial(messageInitialiser, JOB_NAME);

const handler = async job => {
  const invoiceAccountId = get(job, 'data.invoiceAccountId');
  const invoiceAccountData = await invoiceAccountsConnector.getInvoiceAccountById(invoiceAccountId);
  const invoiceAccountMappedData = await chargeModuleMappers.mapInvoiceAccountToChargeModuleCustomer(invoiceAccountData);
  return updateCustomer(invoiceAccountMappedData);
};

const onComplete = async (job, queueManager) => {
  logger.info(`onComplete: ${job.id}`);
};

const onFailedHandler = (job, err) => {
  logger.error(`Job ${job.name} ${job.id} failed`, err);
};

exports.jobName = JOB_NAME;
exports.createMessage = createMessage;
exports.handler = handler;
exports.onComplete = onComplete;
exports.onFailed = onFailedHandler;
exports.hasScheduler = true;
