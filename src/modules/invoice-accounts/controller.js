'use strict';

const controller = require('../../lib/controller');
const invoiceAccountService = require('../../lib/services/invoice-accounts-service');
const invoiceAccountAddressMapper = require('../../lib/mappers/invoice-account-address');
const mapErrorResponse = require('../../lib/map-error-response');
const { jobName: updateCustomerDetailsInCMJobName } = require('../../modules/billing/jobs/update-customer');

/**
 * Gets an invoice account for the specified ID
 * Also returns addresses for the invoice account if any exist
 */
const getInvoiceAccount = async request =>
  controller.getEntity(request.params.invoiceAccountId, invoiceAccountService.getByInvoiceAccountId);

const postInvoiceAccountAddress = async (request, h) => {
  try {
    const { invoiceAccountId } = request.params;
    const { startDate, address, agentCompany, contact } = request.payload;

    // Map supplied data to InvoiceAccountAddress service model
    const invoiceAccountAddress = invoiceAccountAddressMapper.pojoToModel({
      dateRange: {
        startDate,
        endDate: null
      },
      agentCompany,
      address,
      contact
    });

    const result = await invoiceAccountService.createInvoiceAccountAddress(invoiceAccountId, invoiceAccountAddress);

    // Create BullMQ message to update the invoice account in CM
    await request.queueManager.add(updateCustomerDetailsInCMJobName, invoiceAccountId);

    return result;
  } catch (err) {
    return mapErrorResponse(err);
  }

  // postInvoiceAccountAddress
};

exports.getInvoiceAccount = getInvoiceAccount;
exports.postInvoiceAccountAddress = postInvoiceAccountAddress;
