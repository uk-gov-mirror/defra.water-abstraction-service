'use strict';

/**
 * A class to help with loading YAML files from multiple
 * loaders, maintaining a shared set of references among
 * the loaders
 */

class SetLoader {
  /**
   * @param {Object} fixtureLoaders - key/value pairs of fixture loaders
   */
  constructor (fixtureLoaders = {}) {
    this._fixtureLoaders = new Map(Object.entries(fixtureLoaders));
    this._refs = new Map();
  }

  /**
   * Gets a fixture loader by service name
   *
   * @param {String} name - service name
   * @returns {FixtureLoader}
   */
  get (name) {
    return this._fixtureLoaders.get(name);
  }

  /**
   * Gets a names reference
   *
   * @param {String} key
   * @returns {Mixed}
   */
  getRef (key) {
    return this._refs.get(key);
  }

  /**
   * Loads a single file using the named fixture loader
   *
   * @param {String} name
   * @param {String} yamlFile
   * @returns {Promise}
   */
  async load (name, yamlFile) {
    const loader = this.get(name);

    await loader
      .setRefs(this._refs)
      .load(yamlFile);

    // Update refs
    this._refs = loader.getRefs();

    return this;
  }
}

module.exports = SetLoader;
