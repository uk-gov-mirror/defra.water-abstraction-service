'use strict';

const Model = require('./model');
const DateRange = require('./date-range');

const validators = require('./validators');

const { TIME_PERIODS } = require('./constants');

class ReturnLine extends Model {
  /**
   * Sets volume in cubic metres
   * @param {Number} volume
   */
  set volume (volume) {
    validators.assertNullableQuantity(volume);
    this._volume = volume;
  }

  get volume () {
    return this._volume;
  }

  /**
   * Sets the date range of the return line
   * @param {DateRange} dateRange
   */
  set dateRange (dateRange) {
    validators.assertIsInstanceOf(dateRange, DateRange);
    this._dateRange = dateRange;
  }

  get dateRange () {
    return this._dateRange;
  }

  /**
   * The return line frequency day/week/month etc
   * @param {String} timePeriod day|week|month
   */
  set timePeriod (timePeriod) {
    validators.assertEnum(timePeriod, Object.values(TIME_PERIODS));
    this._timePeriod = timePeriod;
  }

  get timePeriod () {
    return this._timePeriod;
  }
}

module.exports = ReturnLine;
