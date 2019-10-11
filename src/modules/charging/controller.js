const chargeHelpers = require('./lib');

/**
 * - Load charge version data and elements
 * - Load licence and get earliest end date
 * - Pro-rata the billable days for each charge element
 * - Get CRM billing contacts for licence number
*/

const getPreviewCharge = async (request, h) => {
  const chargeVersionId = request.params.chargeVersionId;
  const financialYear = request.query.financialYear;

  return chargeHelpers.chargeProcessor(financialYear, chargeVersionId);
};

exports.getPreviewCharge = getPreviewCharge;
