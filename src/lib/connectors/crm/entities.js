const { serviceRequest } = require('@envage/water-abstraction-helpers');
const { partialRight } = require('lodash');
const config = require('../../../../config');
const helpers = require('@envage/water-abstraction-helpers');

const getEntityContent = async (entityId, pathTail) => {
  const url = `${config.services.crm}/entity/${entityId}/${pathTail}`;
  return serviceRequest.get(url);
};

const getEntityCompanies = partialRight(getEntityContent, 'companies');

const getEntityVerifications = partialRight(getEntityContent, 'verifications');

/**
 * update CRM db row for entity with new email for entity_nm
 */
const updateEntityEmail = async (entityId, newEmail) => {
  return helpers.serviceRequest.patch(`${process.env.CRM_URI}/entity/${entityId}/entity`,
    { entity_id: entityId, entity_nm: newEmail });
};

module.exports = {
  getEntityCompanies,
  getEntityVerifications,
  updateEntityEmail
};
