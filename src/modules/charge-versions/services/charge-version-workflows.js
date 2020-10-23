'use strict';

const bluebird = require('bluebird');
const { get } = require('lodash');
// Services
const service = require('../../../lib/services/service');
const documentsService = require('../../../lib/services/documents-service');
const chargeVersionService = require('../../../lib/services/charge-versions');
const errors = require('../../../lib/errors');

// Repos
const chargeVersionWorkflowsRepo = require('../../../lib/connectors/repos/charge-version-workflows');

// Mappers
const chargeVersionWorkflowMapper = require('../../../lib/mappers/charge-version-workflow');

// Models
const validators = require('../../../lib/models/validators');
const ChargeVersionWorkflow = require('../../../lib/models/charge-version-workflow');
const { CHARGE_VERSION_WORKFLOW_STATUS } = require('../../../lib/models/charge-version-workflow');
const ChargeVersion = require('../../../lib/models/charge-version');
const User = require('../../../lib/models/user');
const Licence = require('../../../lib/models/licence');
const Role = require('../../../lib/models/role');
const { NotFoundError, InvalidEntityError } = require('../../../lib/errors');
const { logger } = require('../../../logger');

/**
 * Gets all charge version workflows from the DB
 * @return {Promise<Array>}
 */
const getAll = () => service.findAll(chargeVersionWorkflowsRepo.findAll, chargeVersionWorkflowMapper);

/**
 * Gets the licence-holder role for the supplied ChargeVersionWorkflow model
 * This is based on the licence number, and the start date of the charge
 * version
 * @param {ChargeVersionWorkflow} chargeVersionWorkflow
 * @return {Promise<Role>}
 */
const getLicenceHolderRole = async chargeVersionWorkflow => {
  const { licenceNumber } = chargeVersionWorkflow.licence;
  const startDate = get(chargeVersionWorkflow, 'chargeVersion.dateRange.startDate', null);
  const doc = await documentsService.getValidDocumentOnDate(licenceNumber, startDate);

  if (!doc) {
    throw new errors.NotFoundError(`Current or superseded document not found for ${licenceNumber} on ${startDate}`);
  }

  return {
    chargeVersionWorkflow,
    licenceHolderRole: doc.getRoleOnDate(Role.ROLE_NAMES.licenceHolder, startDate)
  };
};

/**
 * Gets all charge version workflows from the DB, including the
 * licence holder role
 * @return {Promise<Array>}
 */
const getAllWithLicenceHolder = async () => {
  const chargeVersionWorkflows = await getAll();
  return bluebird.map(chargeVersionWorkflows, getLicenceHolderRole);
};

/**
 * Gets a single charge version workflow by ID
 * @param {String} id
 */
const getById = id => service.findOne(id, chargeVersionWorkflowsRepo.findOne, chargeVersionWorkflowMapper);

/**
 * Gets a single charge version workflow by ID
 * with the licence holder
 * @param {String} id
 */
const getByIdWithLicenceHolder = async id => {
  const chargeVersionWorkflow = await getById(id);
  return chargeVersionWorkflow && getLicenceHolderRole(chargeVersionWorkflow);
};

/**
 * Gets all charge version workflow for the
 * given licence id
 * @param {String} licenceId
 */
const getManyByLicenceId = async licenceId =>
  service.findMany(licenceId, chargeVersionWorkflowsRepo.findManyForLicence, chargeVersionWorkflowMapper);

/**
 * Updates the properties on the model - if any errors,
 * an InvalidEntityError is thrown
 * @param {ChargeVersionWorkflow} chargeVersionWorkflow
 * @param {Object} changes - a hash of properties to update
 */
const setOrThrowInvalidEntityError = (chargeVersionWorkflow, changes) => {
  try {
    return chargeVersionWorkflow.fromHash(changes);
  } catch (err) {
    logger.error(err);
    throw new InvalidEntityError(`Invalid data for charge version workflow ${chargeVersionWorkflow.id}`);
  }
};

/**
 * Create a new charge version workflow record
 * @param {Licence} licence
 * @param {ChargeVersion} chargeVersion
 * @param {User} user
 * @return {Promise<ChargeVersionWorkflow>}
 */
const create = async (licence, chargeVersion, user) => {
  validators.assertIsInstanceOf(licence, Licence);
  validators.assertIsInstanceOf(chargeVersion, ChargeVersion);
  validators.assertIsInstanceOf(user, User);

  // Map all data to ChargeVersionWorkflow model
  const chargeVersionWorkflow = new ChargeVersionWorkflow();

  setOrThrowInvalidEntityError(chargeVersionWorkflow, {
    createdBy: user,
    licence: licence,
    chargeVersion,
    status: CHARGE_VERSION_WORKFLOW_STATUS.review
  });

  const dbRow = chargeVersionWorkflowMapper.modelToDb(chargeVersionWorkflow);
  const updated = await chargeVersionWorkflowsRepo.create(dbRow);
  return chargeVersionWorkflowMapper.dbToModel(updated);
};

/**
 * Updates a ChargeVersionWorkflow model
 * @param {String} chargeVersionWorkflowId
 * @param {Object} changes
 * @return {Promise<ChargeVersionWorkflow} - updated service model
 */
const update = async (chargeVersionWorkflowId, changes) => {
  // Load existing model
  const model = await getById(chargeVersionWorkflowId);
  if (!model) {
    throw new NotFoundError(`Charge version workflow ${chargeVersionWorkflowId} not found`);
  }

  setOrThrowInvalidEntityError(model, changes);

  // Persist
  const dbRow = chargeVersionWorkflowMapper.modelToDb(model);
  const data = await chargeVersionWorkflowsRepo.update(chargeVersionWorkflowId, dbRow);
  return chargeVersionWorkflowMapper.dbToModel(data);
};

/**
 * Deletes a charge version workflow record by ID
 * @param {String} chargeVersionWorkflowId
 * @return {Promise}
 */
const deleteById = async chargeVersionWorkflowId => {
  try {
    await chargeVersionWorkflowsRepo.deleteOne(chargeVersionWorkflowId);
  } catch (err) {
    throw new NotFoundError(`Charge version workflow ${chargeVersionWorkflowId} not found`);
  }
};

/**
 * Creates a charge version from the supplied charge version workflow
 * @param {ChargeVersionWorkflow} chargeVersionWorkflow
 * @return {Promise<ChargeVersion>}
 */
const approve = async (chargeVersionWorkflow, approvedBy) => {
  validators.assertIsInstanceOf(chargeVersionWorkflow, ChargeVersionWorkflow);
  validators.assertIsInstanceOf(approvedBy, User);

  const { chargeVersion } = chargeVersionWorkflow;

  // Store users who created/approved
  chargeVersion.fromHash({
    createdBy: chargeVersionWorkflow.createdBy,
    approvedBy
  });

  // Persist the new charge version
  const persistedChargeVersion = await chargeVersionService.create(chargeVersion);

  // Delete the charge version workflow record as it is no longer needed
  await deleteById(chargeVersionWorkflow.id);

  return persistedChargeVersion;
};

exports.getAll = getAll;
exports.getAllWithLicenceHolder = getAllWithLicenceHolder;
exports.getById = getById;
exports.getByIdWithLicenceHolder = getByIdWithLicenceHolder;
exports.create = create;
exports.getLicenceHolderRole = getLicenceHolderRole;
exports.getManyByLicenceId = getManyByLicenceId;
exports.update = update;
exports.delete = deleteById;
exports.approve = approve;
