'use strict';

const { isNull, max } = require('lodash');

const Model = require('./model');
const AbstractionPeriod = require('./abstraction-period');
const DateRange = require('./date-range');
const Purpose = require('./purpose');
const PurposeUse = require('./purpose-use');
const { CHARGE_SEASON, LOSSES } = require('./constants');

const validators = require('./validators');

const validSources = {
  supported: 'supported',
  unsupported: 'unsupported',
  tidal: 'tidal',
  kielder: 'kielder'
};

class ChargeElement extends Model {
  /**
   * Source
   * @return {String}
   */
  get source () {
    return this._source;
  }

  set source (source) {
    validators.assertEnum(source, Object.values(validSources));
    this._source = source;
  }

  /**
   * EIUC source is derived from source
   * and is either tidal|other
   * @return {String}
   */
  get eiucSource () {
    return this._source === 'tidal' ? 'tidal' : 'other';
  }

  /**
   * Season
   * @return {String}
   */
  get season () {
    return this._season;
  }

  set season (season) {
    validators.assertEnum(season, Object.values(CHARGE_SEASON));
    this._season = season;
  }

  /**
   * Loss
   * @return {String}
   */
  get loss () {
    return this._loss;
  }

  set loss (loss) {
    validators.assertEnum(loss, Object.values(LOSSES));
    this._loss = loss;
  }

  /**
   * Abstraction period
   * @return {AbstractionPeriod}
   */
  get abstractionPeriod () {
    return this._abstractionPeriod;
  }

  set abstractionPeriod (abstractionPeriod) {
    validators.assertIsInstanceOf(abstractionPeriod, AbstractionPeriod);
    this._abstractionPeriod = abstractionPeriod;
  }

  /**
   * Authorised annual quantity - Ml
   * @return {Number}
   */
  get authorisedAnnualQuantity () {
    return this._authorisedAnnualQuantity;
  }

  set authorisedAnnualQuantity (quantity) {
    validators.assertQuantity(quantity);
    this._authorisedAnnualQuantity = parseFloat(quantity);
  }

  /**
   * Billable annual quantity - Ml
   * @return {Number}
   */
  get billableAnnualQuantity () {
    return this._billableAnnualQuantity;
  }

  set billableAnnualQuantity (quantity) {
    validators.assertNullableQuantity(quantity);
    this._billableAnnualQuantity = isNull(quantity) ? null : parseFloat(quantity);
  }

  /**
   * Gets the maximum allowable annual quantity
   * @return {Number}
   */
  get maxAnnualQuantity () {
    return max([this.billableAnnualQuantity, this.authorisedAnnualQuantity]);
  }

  /**
   * Gets billing quantity to use
   * This could be auth, billable or actual quantity
   * @return {Number}
   */
  get volume () {
    return this._billableAnnualQuantity || this._authorisedAnnualQuantity;
  }

  /**
   * Primary purpose
   * @param {Purpose}
   */
  set purposePrimary (purposePrimary) {
    validators.assertIsInstanceOf(purposePrimary, Purpose);
    this._purposePrimary = purposePrimary;
  }

  get purposePrimary () {
    return this._purposePrimary;
  }

  /**
   * Secondary purpose
   * @param {Purpose}
   */
  set purposeSecondary (purposeSecondary) {
    validators.assertIsInstanceOf(purposeSecondary, Purpose);
    this._purposeSecondary = purposeSecondary;
  }

  get purposeSecondary () {
    return this._purposeSecondary;
  }

  /**
   * An instance of PurposeUse for the tertiary/use purpose
   * @param {PurposeUse}
   */
  set purposeUse (purposeUse) {
    validators.assertIsInstanceOf(purposeUse, PurposeUse);
    this._purposeUse = purposeUse;
  }

  get purposeUse () {
    return this._purposeUse;
  }

  /**
  * An instance of Date Range containing the time limited start
  * and end dates, only exists if both dates exist
  * @param {dateRange}
  */
  set timeLimitedPeriod (dateRange) {
    validators.assertIsNullableInstanceOf(dateRange, DateRange);
    this._timeLimitedPeriod = dateRange;
  }

  get timeLimitedPeriod () {
    return this._timeLimitedPeriod;
  }

  get description () { return this._description; }
  set description (description) {
    validators.assertNullableString(description);
    this._description = description;
  }

  get chargeVersionId () { return this._chargeVersionId; }
  set chargeVersionId (chargeVersionId) {
    validators.assertId(chargeVersionId);
    this._chargeVersionId = chargeVersionId;
  }

  get isFactorsOverridden () { return this._isFactorsOverridden; }
  set isFactorsOverridden (isFactorsOverridden) {
    validators.assertIsBoolean(isFactorsOverridden);
    this._isFactorsOverridden = isFactorsOverridden;
  }

  toJSON () {
    return {
      ...super.toJSON(),
      eiucSource: this.eiucSource,
      maxAnnualQuantity: this.maxAnnualQuantity
    };
  }
}

module.exports = ChargeElement;
module.exports.sources = validSources;
