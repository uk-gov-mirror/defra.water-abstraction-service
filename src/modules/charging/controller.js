const Boom = require('@hapi/boom');
const chargeHelpers = require('./lib');
const { ERROR_CHARGE_VERSION_NOT_FOUND } = require('./lib/errors.js');

/**
 * - Load charge version data and elements
 * - Load licence and get earliest end date
 * - Pro-rata the billable days for each charge element
 * - Get CRM billing contacts for licence number
*/

const getPreviewCharge = async (request, h) => {
  const chargeVersionId = request.params.chargeVersionId;
  const financialYear = request.query.financialYear;

  const { error, data } = await chargeHelpers.chargeProcessor(financialYear, chargeVersionId);

  if (error === ERROR_CHARGE_VERSION_NOT_FOUND) {
    throw Boom.notFound(`Charge version ${chargeVersionId}`);
  }

  return data;
};

exports.getPreviewCharge = getPreviewCharge;
