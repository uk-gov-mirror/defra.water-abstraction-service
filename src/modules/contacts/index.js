const deepMap = require('deep-map');
const { find } = require('lodash');
const { throwIfError } = require('@envage/hapi-pg-rest-api');
const { findCurrent } = require('../../lib/licence-transformer/nald-functional');
const { licences } = require('../../lib/connectors/permit');
const { licence: { regimeId, typeId } } = require('../../../config');
// const { contactsFormatter } = require('../import/transform-crm');

const mapNulls = obj => deepMap(obj, value => value === 'null' ? null : value);

/**
 * Get a filter to load a water abstraction licence with specified licence number
 * @param  {String} licenceNumber
 * @return {Object}               - filter object for permit repo API call
 */
const getLicenceFilter = (licenceNumber) => {
  return {
    licence_type_id: typeId,
    licence_regime_id: regimeId,
    licence_ref: licenceNumber
  };
};

/**
 * Load licence data from API
 * @param  {String} licenceNumber
 * @return {Promise}               resolves with licence data
 */
const loadLicenceData = async (licenceNumber) => {
  const filter = getLicenceFilter(licenceNumber);
  const { data: [ licence ], error } = await licences.findMany(filter);

  throwIfError(error);

  if (!licence) {
    throw new Error(`Licence ${licenceNumber} not found in permit repo`);
  }

  return mapNulls(licence.licence_data_value);
};

/**
 * Gets an address in the supplied array by ID
 * @param  {Array} contacts  - list of NALD contacts
 * @param  {String} addressId - address ID
 * @return {Object}           - address object
 */
const getAddress = (contacts, addressId) => {
  return find(contacts, { AADD_ID: addressId });
};

const getParty = (parties, partyId) => {
  return find(parties, { ID: partyId });
};

const getLicenceHolder = (currentVersion) => {
  const party = getParty(currentVersion.parties, currentVersion.ACON_APAR_ID);
  const address = getAddress(party.contacts, currentVersion.ACON_AADD_ID);
  return mapContact(party, address);
};

const isOrganisation = (party) => party.APAR_TYPE === 'ORG';

const mapAddress = address => {
  return {
    addressLine1: address.ADDR_LINE1,
    addressLine2: address.ADDR_LINE2,
    addressLine3: address.ADDR_LINE3,
    addressLine4: address.ADDR_LINE4,
    town: address.TOWN,
    county: address.COUNTY,
    postcode: address.POSTCODE,
    country: address.COUNTRY
  };
};

const mapParty = party => {
  const { INITIALS: initials, NAME: name, FORENAME: forename, SALUTATION: salutation } = party;

  const parts = initials
    ? [ salutation, initials, name ]
    : [ salutation, forename, name ];

  const fullName = parts.filter(x => x).join(' ');

  return {
    salutation,
    initials,
    forename,
    name,
    fullName
  };
};

const mapContact = (party, address) => {
  return {
    contactType: isOrganisation(party) ? 'Organisation' : 'Person',
    ...mapAddress(address.party_address),
    ...mapParty(party)
  };
};

/**
 * Gets all contacts for a particular licence number
 * @param  {String}  licenceNumber
 * @return {Promise}               - resolves with array of contacts
 */
const getContacts = async (licenceNumber) => {
  // Load contacts from licence
  const licenceData = await loadLicenceData(licenceNumber);

  const current = findCurrent(licenceData.data.versions);

  const contact = {
    role: 'Licence holder',
    ...getLicenceHolder(current)
  };

  console.log(contact);
};

module.exports = {
  getContacts
};
