const { mapKeys } = require('lodash');
const camelCase = require('camelcase');

exports.camelCaseKeys = obj => mapKeys(obj, (value, key) => camelCase(key));
