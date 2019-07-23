const { head } = require('lodash');
const { throwIfError } = require('@envage/hapi-pg-rest-api');
const apiClientFactory = require('./api-client-factory');
const helpers = require('@envage/water-abstraction-helpers');

const usersClient = apiClientFactory.create(`${process.env.IDM_URI}/user`);
const { idm: { application } } = require('../../../config');

/**
 * Find all users that have an external_id value in the array of ids
 */
usersClient.getUsersByExternalId = async ids => {
  if (ids.length === 0) {
    return { data: [] };
  }
  return usersClient.findMany({
    external_id: { $in: ids },
    application
  });
};

/**
 * Find a single user that has the given user name
 */
usersClient.getUserByUserName = async userName => {
  const { error, data } = await usersClient.findMany({
    user_name: userName,
    application
  });
  throwIfError(error);
  return head(data);
};

/**
 * call IDM to check user credentials and create email change record
 */
const createEmailChangeRecord = (userId, password) => {
  const url = `${process.env.IDM_URI}/user/change-email-address/start`;
  return helpers.serviceRequest.post(url, { userId, password });
};

/**
 * call IDM to update record with new email address
 */
const addNewEmailToEmailChangeRecord = (verificationId, newEmail) => {
  const url = `${process.env.IDM_URI}/user/change-email-address/create-code`;
  return helpers.serviceRequest.patch(url, { verificationId, newEmail });
};

/**
 * check if record matching userId and securityCode exists
 * @param  {Int} userId
 * @param  {Int} securityCode
 */
const verifySecurityCode = (userId, securityCode) => {
  const url = `${process.env.IDM_URI}/user/change-email-address/complete`;
  return helpers.serviceRequest.post(url, { userId, securityCode });
};

exports.usersClient = usersClient;
exports.createEmailChangeRecord = createEmailChangeRecord;
exports.addNewEmailToEmailChangeRecord = addNewEmailToEmailChangeRecord;
exports.verifySecurityCode = verifySecurityCode;
