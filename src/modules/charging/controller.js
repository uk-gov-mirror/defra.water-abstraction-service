const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(require('moment'));

const helpers = require('@envage/water-abstraction-helpers');
const crmMappers = require('./lib/crm-mappers');
const dateHelpers = require('./lib/date-helpers');
const { camelCaseKeys } = require('./lib/mappers');
const repository = require('../../lib/connectors/repository');
const { get, flatMap, groupBy, cloneDeep, each } = require('lodash');

const DATE_FORMAT = 'YYYY-MM-DD';

const getLicenceAgreements = async licenceNumber => [
  {
    startDate: '2017-01-01',
    endDate: null,
    code: 127
  },
  {
    startDate: '2019-09-01',
    endDate: '2019-12-31',
    code: 130
  }
];

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
    const rangeA = moment.range(chargeVersion.startDate, chargeVersion.endDate);
    const rangeB = moment.range(row.timeLimitedStartDate, row.timeLimitedEndDate);

    const intersection = rangeA.intersect(rangeB);
    if (intersection) {
      const startDate = intersection.start.format(DATE_FORMAT);
      const endDate = intersection.end.format(DATE_FORMAT);
      acc.push(augmentElementWithBillingPeriod(chargeVersion, row, startDate, endDate));
    }
  } else {
    const { startDate, endDate } = chargeVersion;
    acc.push(augmentElementWithBillingPeriod(chargeVersion, row, startDate, endDate));
  }
  return acc;
}, []);

/**
 * Processes licence-level agreements that affect charging
 * @param {Array} data
 * @param {String} licenceNumber
 * @return {Promise<Array>} data - split by charge agreement changes
 */
const processAgreements = async (data, licenceNumber) => {
  let updated = cloneDeep(data);
  const agreements = await getLicenceAgreements(licenceNumber);
  const grouped = groupBy(agreements, row => row.code);

  each(grouped, (agreements, key) => {
    const propertyKey = `section${key}`;
    const history = dateHelpers.mergeHistory(agreements);
    const arr = updated
      .map(row => helpers.charging.dateRangeSplitter(row, history, propertyKey));
    updated = flatMap(arr).map(applyEffectiveDates);
  });

  return updated;
};

/**
 * Processes charging elements and augments charge data array
 * @param {Array} data
 * @param {String} chargeVersionId
 */
const processChargingElements = async (data, chargeVersionId) => {
  const chargeElements = await getChargeElements(chargeVersionId);
  return data.map(row => ({
    ...row,
    chargeElements: chargeElementProcessor(row, chargeElements)
  }));
};

const processLicenceHolders = (data, docs) => {
  const licenceHolders = dateHelpers.mergeHistory(
    crmMappers.getLicenceHolderRoles(docs), isSameLicenceHolder
  );
  return helpers.charging
    .dateRangeSplitter(data, licenceHolders, 'licenceHolder')
    .map(applyEffectiveDates);
};

const processInvoiceAccounts = (data, docs) => {
  const billing = dateHelpers.mergeHistory(crmMappers.getBillingRoles(docs));
  return flatMap(data.map(row => helpers.charging
    .dateRangeSplitter(row, billing, 'invoiceAccount')
    .map(applyEffectiveDates)));
};

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
  const chargeVersion = await getChargeVersion(chargeVersionId);

  // Constrain charge version dates by financial year
  const dateRange = dateHelpers.getSmallestDateRange([
    financialYear,
    chargeVersion
  ]);
  let data = { chargeVersion, financialYear, ...dateRange, isTwoPart, isSummer };

  // Load CRM docs
  const docs = await getCRMDocuments();

  // Process and split into date ranges
  data = processLicenceHolders(data, docs);
  data = processInvoiceAccounts(data, docs);
  data = await processAgreements(data, chargeVersion.licenceRef);
  data = await processChargingElements(data, chargeVersionId);

  return data;
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
