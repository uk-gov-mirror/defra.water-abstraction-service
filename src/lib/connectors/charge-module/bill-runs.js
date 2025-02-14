'use strict';

const request = require('./request');

/**
 * Creates a bill run in the CM for the specified region code
 * @param {String} region - the single letter region code
 * @return {Promise<Object>} response payload
 */
const create = region =>
  request.post('v2/wrls/bill-runs', { region });

/**
 * Adds a transaction to the specified bill run
 * @param {String} billRunId - CM bill ID GUID
 * @param {Object} transaction - CM transaction payload
 * @return {Promise<Object>} response payload
 */
const addTransaction = (billRunId, transaction) =>
  request.post(`v2/wrls/bill-runs/${billRunId}/transactions`, transaction);

/**
 * Approves the spefified CM bill run
 * @param {String} billRunId - CM bill ID GUID
 * @return {Promise<Object>} response payload
 */
const approve = billRunId =>
  request.patch(`v2/wrls/bill-runs/${billRunId}/approve`);

/**
 * Sends the specified CM bill run
 * @param {String} billRunId - CM bill ID GUID
 * @return {Promise<Object>} response payload
 */
const send = billRunId =>
  request.patch(`v2/wrls/bill-runs/${billRunId}/send`);

/**
 * Deletes a specified invoice from a given bill run
 * @param {String} billRunId - CM bill ID GUID
 * @param {String} invoiceId - CM invoice ID GUID
 * @return {Promise<Object>} response payload
 */
const deleteInvoiceFromBillRun = (billRunId, invoiceId) =>
  request.delete(`v2/wrls/bill-runs/${billRunId}/invoices/${invoiceId}`);

/**
 * Deletes entire bill run
 * @param {String} billRunId - CM bill ID GUID
 * @return {Promise<Object>} response payload
 */
const deleteBillRun = billRunId =>
  request.delete(`v2/wrls/bill-runs/${billRunId}`);

/**
 * Gets bill run including summary data
 * @param {String} billRunId - CM bill ID GUID
 * @return {Promise<Object>} response payload
 */
const get = billRunId =>
  request.get(`v2/wrls/bill-runs/${billRunId}`);

/**
   * Gets transactions in given bill run for a particular invoice.
   * @param {String} billRunId
   * @param {String} invoiceId
   */
const getInvoiceTransactions = (billRunId, invoiceId) => {
  const path = `v2/wrls/bill-runs/${billRunId}/invoices/${invoiceId}`;
  return request.get(path);
};

const generate = CMBillRunId => {
  const path = `v2/wrls/bill-runs/${CMBillRunId}/generate`;
  return request.patch(path);
};

exports.addTransaction = addTransaction;
exports.approve = approve;
exports.create = create;
exports.delete = deleteBillRun;
exports.get = get;
exports.deleteBillRun = deleteBillRun;
exports.send = send;
exports.getInvoiceTransactions = getInvoiceTransactions;
exports.deleteInvoiceFromBillRun = deleteInvoiceFromBillRun;
exports.generate = generate;
