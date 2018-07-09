/**
 * Licence transformer
 * To support abstraction reform, the format of data may change in future
 * This layer can transform licence data to different formats
 * @module lib/licence-transformer/index
 */
const NALDTransformer = require('./nald-transformer');
const FORMAT_NALD = 'NALD';
const FORMAT_CSV = 'CSV';

class UnsupportedLicenceFormatError extends Error {
  constructor (message) {
    super(message);
    this.name = 'UnsupportedLicenceFormatError';
  }
};

class LicenceTransformer {
  /**
   * Constructor
   * @param {Object} data - licence data
   */
  async load (data) {
    const format = this.guessFormat(data);

    switch (format) {
      case FORMAT_NALD:
        this.transformer = new NALDTransformer();
        break;

      case FORMAT_CSV:
        this.transformer = new CSVTransformer();
        break;

      default:
        throw new UnsupportedLicenceFormatError();
    }

    await this.transformer.load(data);
  }

  /**
   * Export data
   * @return {Object}
   */
  export () {
    return this.transformer.export();
  }

  /**
   * Guess the data format from the supplied data
   * @param {Object}
   * @return {String} data format
   */
  guessFormat (data) {
    return FORMAT_NALD;
  }
}

module.exports = LicenceTransformer;
