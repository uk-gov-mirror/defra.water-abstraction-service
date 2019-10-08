const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(require('moment'));

const helpers = require('@envage/water-abstraction-helpers');
const crmMappers = require('./lib/crm-mappers');
const dateHelpers = require('./lib/date-helpers');
const { camelCaseKeys } = require('./lib/mappers');
const repository = require('../../lib/connectors/repository');
const { get, flatMap } = require('lodash');

const DATE_FORMAT = 'YYYY-MM-DD';

// Get documents for licence number
const getCRMDocuments = async licenceRef => [{
  documentId: 'document_1',
  regime: 'water',
  documentType: 'abstraction_licence',
  versionNumber: 101,
  documentRef: '01/123',
  status: 'superseded',
  startDate: '2012-08-13',
  endDate: '2019-05-12',
  documentRoles: [
    {
      startDate: '2012-08-13',
      endDate: null,
      role: 'licenceHolder',
      company: {
        companyId: 'company_1',
        name: 'Daisy farms'
      },
      contact: {
        contactId: 'contact_1',
        salutation: 'Mr',
        firstName: 'John',
        lastName: 'Doe'
      },
      address: {
        addressId: 'address_1',
        address1: 'Daisy cottage',
        address2: 'Buttercup lane',
        town: 'Testington',
        county: 'Testingshire',
        postcode: 'TT1 1TT',
        country: 'England'
      }
    },
    {
      startDate: '2012-08-13',
      endDate: null,
      role: 'billing',
      company: {
        companyId: 'company_1'
      },
      invoiceAccount: {
        invoiceAccountId: 'invoice_account_1',
        iasNumber: '01234',
        company: {
          companyId: 'company_1',
          name: 'Daisy farms'
        }
      }
    }]
}, {
  documentId: 'document_2',
  regime: 'water',
  documentType: 'abstraction_licence',
  versionNumber: 102,
  documentRef: '01/123',
  status: 'current',
  startDate: '2019-05-03',
  documentRoles: [
    {
      startDate: '2019-05-03',
      endDate: null,
      role: 'licenceHolder',
      company: {
        companyId: 'company_1'
      },
      contact: {
        contactId: 'contact_1',
        salutation: 'Mr',
        firstName: 'John',
        lastName: 'Doe'
      },
      address: {
        addressId: 'address_1',
        address1: 'Daisy cottage',
        address2: 'Buttercup lane',
        town: 'Testington',
        county: 'Testingshire',
        postcode: 'TT1 1TT',
        country: 'England'
      }
    },
    {
      startDate: '2019-05-03',
      endDate: null,
      role: 'billing',
      company: {
        companyId: 'company_1'
      },
      invoiceAccount: {
        invoiceAccountId: 'invoice_account_1',
        iasNumber: '01234',
        company: {
          companyId: 'company_1',
          name: 'Daisy farms'
        }
      }
    }]
}];

const isSameLicenceHolder = (roleA, roleB) =>
  get(roleA, 'company.companyId') === get(roleB, 'company.companyId') &&
    get(roleA, 'contact.contactId') === get(roleB, 'contact.contactId');

const applyEffectiveDates = obj => ({
  ...obj,
  startDate: obj.effectiveStartDate,
  endDate: obj.effectiveEndDate,
  originalStartDate: obj.startDate,
  originalEndDate: obj.endDate
});

/**
 * Loads charge version data from DB and camel-cases all keys
 * @param {String} chargeVersionId
 * @return {Promise<Object>}
 */
const getChargeVersion = async chargeVersionId => {
  const data = await repository.chargeVersions.findOneById(chargeVersionId);
  return camelCaseKeys(data);
};

/**
 * Loads charge element data from DB and camel-cases all keys
 * @param {String} chargeVersionId
 * @return {Promise<Array>}
 */
const getChargeElements = async chargeVersionId => {
  const data = await repository.chargeElements.findByChargeVersionId(chargeVersionId);
  return data.map(camelCaseKeys);
};

const isTimeLimited = chargeElement =>
  !(chargeElement.timeLimitedStartDate === null && chargeElement.timeLimitedEndDate === null);

const getAbstractionPeriod = chargeElement => ({
  startDay: chargeElement.abstractionPeriodStartDay,
  startMonth: chargeElement.abstractionPeriodStartMonth,
  endDay: chargeElement.abstractionPeriodEndDay,
  endMonth: chargeElement.abstractionPeriodEndMonth
});

const augmentElementWithBillingPeriod = (chargeVersion, chargeElement, startDate, endDate) => ({
  ...chargeElement,
  startDate,
  endDate,
  totalDays: helpers.charging.getBillableDays(getAbstractionPeriod(chargeElement), chargeVersion.financialYear.startDate, chargeVersion.financialYear.endDate),
  billableDays: helpers.charging.getBillableDays(getAbstractionPeriod(chargeElement), startDate, endDate)
});

/**
 * Calculates the date range and billable days for each charge element.
 * For time-limited elements:
 * - when there is overlap between this and the charge version date range, it is constrained
 * - when there is no overlap, the charge element is omitted
 * @param {Object} chargeVersion
 * @param {Array} chargeElements
 * @return {Array} processed chargeElements
 */
const chargeElementProcessor = (chargeVersion, chargeElements) => chargeElements.reduce((acc, row) => {
  if (isTimeLimited(row)) {
    const intersection = moment.range(chargeVersion.startDate, chargeVersion.endDate).intersect(
      moment.range(row.timeLimitedStartDate, row.timeLimitedEndDate)
    );
    if (intersection) {
      const startDate = intersection.format(DATE_FORMAT);
      const endDate = intersection.format(DATE_FORMAT);
      acc.push(augmentElementWithBillingPeriod(chargeVersion, row, startDate, endDate));
    }
  } else {
    const { startDate, endDate } = chargeVersion;
    acc.push(augmentElementWithBillingPeriod(chargeVersion, row, startDate, endDate));
  }
  return acc;
}, []);

/**
 * @TODO handle two-part billing summer/winter
 * @TODO split by licence-level agreements - TPT/canal
 *
 * @param {Number} year
 * @param {String} chargeVersionId
 * @param {Boolean} isTwoPart
 * @param {Boolean} isSummer
 */
const chargeProcessor = async (year, chargeVersionId, isTwoPart = false, isSummer) => {
  const financialYear = dateHelpers.getFinancialYearRange(year);

  // Load charge version data
  const tasks = [ getChargeVersion(chargeVersionId), getChargeElements(chargeVersionId) ];
  const [ chargeVersion, chargeElements ] = await Promise.all(tasks);

  // Constrain charge version dates by financial year
  const dateRange = dateHelpers.getSmallestDateRange([
    financialYear,
    chargeVersion
  ]);
  let data = { chargeVersion, financialYear, ...dateRange, isTwoPart, isSummer };

  // Load CRM docs
  const docs = await getCRMDocuments();
  const billing = dateHelpers.mergeHistory(crmMappers.getBillingRoles(docs));
  const licenceHolders = dateHelpers.mergeHistory(crmMappers.getLicenceHolderRoles(docs), isSameLicenceHolder);

  data = helpers.charging.dateRangeSplitter(data, licenceHolders, 'licenceHolder').map(applyEffectiveDates);
  data = flatMap(data.map(row => helpers.charging.dateRangeSplitter(row, billing, 'invoiceAccount').map(applyEffectiveDates)));

  // @TODO - split by licence-level agreements - TPT/canal

  // Augment rows with charge elements
  return data.map(row => ({
    ...row,
    chargeElements: chargeElementProcessor(row, chargeElements)
  }));
};

/**
 * @TODO
 * - Load charge version data and elements
 * - Load licence and get earliest end date
 * - Pro-rata the billable days for each charge element
 * - Get CRM billing contacts for licence number
*/

const getPreviewCharge = async (request, h) => {
  const chargeVersionId = request.params.chargeVersionId;
  const financialYear = request.query.financialYear;

  return chargeProcessor(financialYear, chargeVersionId);
};

exports.getPreviewCharge = getPreviewCharge;
