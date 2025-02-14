'use strict';

/**
 * @module syncs the charge module invoices/licences/transactions
 * to the local WRLS DB
 */
const { get, difference } = require('lodash');
const Bluebird = require('bluebird');
const errors = require('../../../lib/errors');

const chargeModuleBillRunConnector = require('../../../lib/connectors/charge-module/bill-runs');
const { logger } = require('../../../logger');

// Mappers
const transactionMapper = require('../mappers/transaction');

// Services
const invoiceService = require('../../../lib/services/invoice-service');
const batchService = require('./batch-service');
const transactionService = require('./transactions-service');

/**
 * Calls CM transactions endpoint multiple times and
 * collates all paginated results for a given invoice
 *
 * @param {String} cmBillRunId
 * @param {String} invoiceId
 * @return {Array<Object>} CM transaction details
 */
const getAllCmTransactionsForInvoice = async (cmBillRunId, invoiceId) => {
  try {
    const { invoice } = await chargeModuleBillRunConnector.getInvoiceTransactions(cmBillRunId, invoiceId);
    return invoice.licences.map(lic => lic.transactions.map(transaction => {
      return {
        ...transaction,
        transactionReference: invoice.transactionReference,
        isDeminimis: invoice.deminimisInvoice,
        licenceNumber: lic.licenceNumber
      };
    })).flat();
  } catch (error) {
    logger.error(`Unable to retrieve transactions for CM invoice. Bill run ID ${cmBillRunId} and invoice ID ${invoiceId}`);
    throw error;
  }
};

const getInvoiceKey = (invoiceAccountNumber, financialYearEnding) =>
  `${invoiceAccountNumber}_${financialYearEnding}`;

/**
 * Get invoices mapped by account number / financial year
 * @param {Batch} batch
 * @return {Map}
 */
const getInvoiceMap = invoices => {
  return invoices.reduce((acc, invoice) => {
    const key = getInvoiceKey(invoice.invoiceAccount.accountNumber, invoice.financialYear.endYear);
    return acc.set(key, invoice);
  }, new Map());
};

/**
 * Gets a map of customer/financial year summaries
 * keyed by customerRef_financialYearEnding
 *
 * @param {Object} cmResponse - full CM batch summary data
 * @return {Map}
 */
const getCMInvoiceMap = cmResponse => {
  return cmResponse.billRun.invoices.map(invoice => {
    return {
      ...invoice,
      key: getInvoiceKey(invoice.customerReference, invoice.financialYear + 1)
    };
  });
};

/**
 * Indexes transactions in an invoice by external ID
 * @param {Invoice} invoice
 * @return {Map}
 */
const getTransactionMap = invoice => {
  return invoice.invoiceLicences.reduce((map, invoiceLicence) => {
    invoiceLicence.transactions.forEach(transaction => {
      map.set(transaction.externalId, transaction);
    });
    return map;
  }, new Map());
};

const mapTransaction = (invoice, transactionMap, cmTransaction) => {
  // Update existing transaction
  if (transactionMap.has(cmTransaction.id)) {
    const calculation = get(cmTransaction, 'calculation.WRLSChargingResponse', {});
    const { sourceFactor, seasonFactor, lossFactor, sucFactor, abatementAdjustment, s127Agreement, eiucFactor, eiucSourceFactor } = calculation;

    return transactionMap
      .get(cmTransaction.id)
      .fromHash({
        isDeMinimis: cmTransaction.isDeminimis,
        value: cmTransaction.chargeValue,
        calcSourceFactor: sourceFactor,
        calcSeasonFactor: seasonFactor,
        calcLossFactor: lossFactor,
        calcSucFactor: sucFactor,
        calcS126Factor: abatementAdjustment,
        calcS127Factor: s127Agreement,
        calcEiucFactor: eiucFactor,
        calcEiucSourceFactor: eiucSourceFactor
      });
  } else {
    // Create a new min charge model and add to heirarchy
    const newTransaction = transactionMapper.cmToModel({ ...cmTransaction, twoPartTariff: false });
    invoice
      .getInvoiceLicenceByLicenceNumber(cmTransaction.licenceNumber)
      .transactions
      .push(newTransaction);
    return newTransaction;
  }
};

const getCMTransactionId = cmTransaction => cmTransaction.id;

/**
 * Deletes transactions no longer in the invoice according to the CM data
 * @param {Array<Object>} cmTransactions
 * @param {Map} transactionMap - keyed by external (CM) id
 * @return {Promise}
 */
const deleteTransactions = (cmTransactions, transactionMap) => {
  const validIds = cmTransactions.map(getCMTransactionId);
  const deleteExternalIds = difference(Array.from(transactionMap.keys()), validIds);
  const deleteIds = deleteExternalIds.map(
    externalId => transactionMap.get(externalId).id
  );
  return transactionService.deleteById(deleteIds);
};

/**
  * Gets transaction reference from cmTransactions
  * NB. it is not guaranteed to be present in all transactions
  * @param {Array<Object>} cmTransactions
  */
const getInvoiceNumber = cmTransactions => {
  const transactionsWithRef = cmTransactions.filter(trans => trans.transactionReference !== null);
  return transactionsWithRef[0] ? transactionsWithRef[0].transactionReference : null;
};

/**
 * Maps CM data to an Invoice model
 *
 * @param {Batch} batch
 * @param {Invoice} invoice
 * @param {Object} cmInvoiceSummary - CM data for this customer/financial year
 * @param {Array<Object>} cmTransactions - transactions for this customer/financial year
 * @return {Invoice}
 */
const updateInvoice = async (batch, invoice, cmInvoiceSummary, cmTransactions) => {
  // Populate invoice model with updated CM data
  invoice.fromHash({
    isDeMinimis: cmInvoiceSummary.deminimisInvoice,
    invoiceNumber: getInvoiceNumber(cmTransactions),
    netTotal: cmInvoiceSummary.netTotal,
    invoiceValue: cmInvoiceSummary.debitLineValue,
    creditNoteValue: -cmInvoiceSummary.creditLineValue,
    externalId: cmInvoiceSummary.id
  });

  // Persist
  await invoiceService.saveInvoiceToDB(batch, invoice);

  // Index WRLS transactions by external ID
  const transactionMap = getTransactionMap(invoice);

  // Create/update transactions
  for (const cmTransaction of cmTransactions) {
    const invoiceLicence = invoice
      .getInvoiceLicenceByLicenceNumber(cmTransaction.licenceNumber);
    const transaction = mapTransaction(invoice, transactionMap, cmTransaction);
    await transactionService.saveTransactionToDB(invoiceLicence, transaction);
  }

  // Delete transactions no longer on the CM side
  await deleteTransactions(cmTransactions, transactionMap);

  return invoice;
};

const updateInvoices = async (batch, cmResponse) => {
  // Fetch WRLS batch invoices
  const invoices = await invoiceService.getInvoicesForBatch(batch, { includeTransactions: true });

  // Map invoices in CM summary response
  const cmInvoiceMap = getCMInvoiceMap(cmResponse);

  // Get existing invoices in DB and map
  const invoiceMap = await getInvoiceMap(invoices);

  // Iterate through invoices in series, to avoid overwhelming CM with too many simultaneous requests
  Bluebird.mapSeries(cmInvoiceMap, async invoice => {
    const cmTransactions = await getAllCmTransactionsForInvoice(
      batch.externalId,
      invoice.id
    );
    // Note: for now we don't need to expect invoices not in our DB
    // this will likely change when the CM implements rebilling
    await updateInvoice(batch, invoiceMap.get(invoice.key), invoice, cmTransactions);
  });
};

const isCMGeneratingSummary = cmResponse => get(cmResponse, 'billRun.status') === 'generating';

const updateBatch = async batchId => {
  // Fetch WRLS batch
  let batch = await batchService.getBatchById(batchId);
  if (!batch) {
    throw new errors.NotFoundError(`CM refresh failed, batch ${batchId} not found`);
  }

  // Get CM bill run summary
  const cmResponse = await chargeModuleBillRunConnector.get(batch.externalId);

  if (isCMGeneratingSummary(cmResponse)) {
    return false;
  }

  // Set batch totals
  batch = await batchService.updateWithCMSummary(batch.id, cmResponse);
  // Update invoices in batch
  await updateInvoices(batch, cmResponse);
  return true;
};

exports.updateBatch = updateBatch;
