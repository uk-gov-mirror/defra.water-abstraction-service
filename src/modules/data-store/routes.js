/**
 * Data storage
 * For catbox implementation
 */
const HAPIRestAPI = require('hapi-pg-rest-api');
const Joi = require('joi');
const {pool} = require('../../lib/connectors/db.js');

const DataStoreAPI = new HAPIRestAPI({
  table: 'water.data_store',
  endpoint: '/water/1.0/dataStore',
  connection: pool,
  primaryKey: 'id',
  primaryKeyAuto: false,
  primaryKeyGuid: false,
  validation: {
    id: Joi.string(),
    value: Joi.string(),
    stored: Joi.number(),
    ttl: Joi.number()
  }
});

module.exports = DataStoreAPI.getRoutes();
