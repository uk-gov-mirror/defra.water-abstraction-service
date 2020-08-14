'use strict';

const Model = require('./model');
const ReturnRequirementPurpose = require('./return-requirement-purpose');

const validators = require('./validators');

/**
 * A model to represent the requirement to complete a return
 * @class
 */
class ReturnRequirement extends Model {
  /**
   * @constructor
   * @param {String} id
   */
  constructor (id) {
    super(id);
    this.returnRequirementPurposes = [];
  }

  /**
   * Whether the return should be completed in the summer
   * or winter/all year cycle
   * @param {Boolean} isSummer - true for summer cycle
   */
  set isSummer (isSummer) {
    validators.assertIsBoolean(isSummer);
    this._isSummer = isSummer;
  }

  get isSummer () {
    return this._isSummer;
  }

  /**
   * Array of purpose uses for this return requirement
   * @param {Array<PurposeUse>}
   */
  set returnRequirementPurposes (returnRequirementPurposes) {
    validators.assertIsArrayOfType(returnRequirementPurposes, ReturnRequirementPurpose);
    this._returnRequirementPurposes = returnRequirementPurposes;
  }

  get returnRequirementPurposes () {
    return this._returnRequirementPurposes;
  }
}

module.exports = ReturnRequirement;
