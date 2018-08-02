const moment = require('moment');
const { mapValues } = require('lodash');

/**
 * Converts 'null' strings to real null in supplied object
 * @param {Object} - plain object
 * @return {Object} with 'null' values converted to 'null'
 */
const convertNullStrings = (obj) => {
  return mapValues(obj, val => val === 'null' ? null : val);
};

const mapFrequency = (str) => {
  const frequencies = {
    'D': 'daily',
    'W': 'weekly',
    'M': 'monthly',
    'A': 'annual'
  };
  return frequencies[str];
};

const mapPeriod = (str) => {
  const periods = {
    'D': 'day',
    'W': 'week',
    'M': 'month',
    'A': 'year'
  };
  return periods[str];
};

/**
 * Calculates start of period based on start/end date and period
 * @param {String} startDate - the returns start date YYYYMMDD
 * @param {String} endDate - the line end date YYYYMMDD
 * @param {String} period - the returns period - A/M/W/D
 * @return {String} a date in format YYYY-MM-DD
 */
const getStartDate = (startDate, endDate, period) => {
  const d = moment(endDate, 'YYYYMMDD');
  let o;

  if (period === 'A') {
    o = moment(startDate, 'YYYYMMDD');
  }
  if (period === 'M') {
    o = d.startOf('month');
  }
  if (period === 'W') {
    o = d.startOf('isoWeek');
  }
  if (period === 'D') {
    o = d;
  }

  return o.format('YYYY-MM-DD');
};

/**
 * Converts units in NALD to recognised SI unit
 * @param {String} unit
 * @return {String} SI unit
 */
const mapUnit = (u) => {
  const units = {
    M: 'm³',
    I: 'gal'
  };
  return units[u] || u;
};

/**
 * Map NALD quantity usability field
 * @param {String} NALD usability flag
 * @return {String} plaintext version
 */
const mapUsability = (u) => {
  const options = {
    E: 'estimate',
    M: 'measured',
    D: 'derived',
    A: 'assessed'
  };
  return options[u];
};

/**
 * Calculates the returns cycles from the supplied
 * @param {Object} row - row of data from return format/version tables
 * @return {Array} a list of periods
 */
const calculateReturnsCycles = (row) => {
  const dateFormat = 'DD/MM/YYYY';
  const effectiveStartDate = moment(row.EFF_ST_DATE, dateFormat);
  const effectiveEndDate = row.EFF_END_DATE === 'NULL' ? null : moment(row.EFF_END_DATE, dateFormat);
  const finalYear = effectiveEndDate ? effectiveEndDate.year() : moment().year();

  const cycles = [];
  for (let year = effectiveStartDate.year(); year <= finalYear; year++) {
    const endYear = row.ABS_PERIOD_END_MONTH >= row.ABS_PERIOD_ST_MONTH ? year : year + 1;
    const cycleStart = moment().year(year).month(row.ABS_PERIOD_ST_MONTH - 1).date(row.ABS_PERIOD_ST_DAY);
    const cycleEnd = moment().year(endYear).month(row.ABS_PERIOD_END_MONTH - 1).date(row.ABS_PERIOD_END_DAY);

    if (cycleStart.isSameOrAfter(effectiveStartDate) && (!effectiveEndDate || cycleEnd.isSameOrBefore(effectiveEndDate))) {
      cycles.push({
        startDate: cycleStart.format('YYYY-MM-DD'),
        endDate: cycleEnd.format('YYYY-MM-DD')
      });
    }
  }

  return cycles;
};

module.exports = {
  convertNullStrings,
  mapFrequency,
  mapPeriod,
  getStartDate,
  mapUnit,
  mapUsability,
  calculateReturnsCycles
};
