'use strict';

/**
 * purposePrimary, purposeSecondary and purposeUse are left in
 * a more readable format but need to be replaced with references to
 * the entries in the tables when the charge element is saved.
 *
 * e.g. purpose_primary_id, purpose_secondary_id and purpose_use_id
 */

exports.ce1 = {
  abstractionPeriodStartDay : 1,
  abstractionPeriodStartMonth : 1,
  abstractionPeriodEndDay : 31,
  abstractionPeriodEndMonth : 12,
  authorisedAnnualQuantity : 200,
  season : 'all year',
  seasonDerived: 'all year',
  source : 'unsupported',
  loss : 'medium',
  purposePrimary : 'A',
  purposeSecondary : 'AGR',
  purposeUse : 140,
  billableAnnualQuantity : null,
  description : 'CE1',
  factorsOverridden : false
};

exports.ce2 = {
  abstractionPeriodStartDay : 1,
  abstractionPeriodStartMonth : 1,
  abstractionPeriodEndDay : 31,
  abstractionPeriodEndMonth : 12,
  season : 'all year',
  seasonDerived: 'all year',
  source : 'unsupported',
  loss : 'low',
  purposePrimary : 'A',
  purposeSecondary : 'AGR',
  purposeUse : 140,
  authorisedAnnualQuantity : 25,
  billableAnnualQuantity : 50,
  description : 'CE2',
  factorsOverridden : false
};

exports.ce3 = {
  abstractionPeriodStartDay : 1,
  abstractionPeriodStartMonth : 1,
  abstractionPeriodEndDay : 31,
  abstractionPeriodEndMonth : 12,
  season : 'all year',
  seasonDerived: 'all year',
  source : 'unsupported',
  loss : 'low',
  purposePrimary : 'A',
  purposeSecondary : 'AGR',
  purposeUse : 140,
  authorisedAnnualQuantity : 50,
  billableAnnualQuantity : 50,
  description : 'CE3',
  factorsOverridden : false
};
