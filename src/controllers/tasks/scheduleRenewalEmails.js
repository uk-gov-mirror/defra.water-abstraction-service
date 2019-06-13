const { throwIfError } = require('@envage/hapi-pg-rest-api');
const { get, find } = require('lodash');

const messageQueue = require('../../lib/message-queue');
const { enqueue } = require('../../modules/notify')(messageQueue);

const crm = {
  documents: require('../../lib/connectors/crm/documents')
};
const Permit = require('../../lib/connectors/permit');

const { logger } = require('../../logger');

const getDocument = async permitId => {
  // Read CRM doc header to get document custom name
  const [ document ] = await crm.documents.findAll({
    system_internal_id: permitId
  });
  return document;
};

const createMessageConfig = (licence, role, document) => {
  const { entityName: recipient } = role;
  return {
    id: `${licence.licence_ref}_${licence.licence_end_dt}_${recipient}`,
    recipient,
    messageRef: 'expiry_notification_email',
    personalisation: {
      licence_no: licence.licence_ref,
      licence_name: document.document_name || ''
    },
    individualEntityId: role.entityId,
    companyEntityId: document.company_entity_id,
    licences: [licence.licence_ref]
  };
};

const scheduleForLicence = async licence => {
  // Get CRM doc
  const document = await getDocument(licence.licence_id);

  // Get document users from CRM to find document user with primary_user role
  const { document_id: documentId } = document;
  const { data, error } = await crm.documents.getDocumentUsers(documentId);
  throwIfError(error);

  const role = find(data, entity => entity.roles.includes('primary_user'));

  // If role found, enqueue message
  if (role) {
    const config = createMessageConfig(licence, role, document);
    await enqueue(config);
  }
};

const scheduleRenewalEmails = async () => {
  try {
    // Get expiring permits
    const { error, data: licences } = await Permit.expiringLicences.findMany();
    throwIfError(error);

    const tasks = licences.map(scheduleForLicence);

    await Promise.all(tasks);

    return { error: null };
  } catch (err) {
    const data = {
      statusCode: get(err, 'statusCode'),
      uri: get(err, 'options.uri')
    };
    logger.error('Error sending scheduled reminder letters', data);
    return { error: err.toString() };
  }
};

module.exports = {
  run: scheduleRenewalEmails
};
