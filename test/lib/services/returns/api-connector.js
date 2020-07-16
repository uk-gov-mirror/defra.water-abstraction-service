const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const { expect } = require('@hapi/code');
const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const returnsApiConnector = require('../../../../src/lib/connectors/returns');
const apiConnector = require('../../../../src/lib/services/returns/api-connector');

experiment('lib/services/returns/api-connector', () => {
  beforeEach(async () => {
    sandbox.stub(returnsApiConnector.versions, 'findAll').resolves([{
      version_id: 'test-version-id'
    }]);
    sandbox.stub(returnsApiConnector.lines, 'findAll').resolves([{
      line_id: 'test-line-id'
    }]);
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.getCurrentVersion', () => {
    let result;

    beforeEach(async () => {
      result = await apiConnector.getCurrentVersion('test-return-id');
    });

    test('calls the API connector with the correct filter and sort params', async () => {
      const [filter, sort] = returnsApiConnector.versions.findAll.lastCall.args;
      expect(filter).to.equal({
        return_id: 'test-return-id',
        current: true
      });
      expect(sort).to.equal({
        version_number: -1
      });
    });

    test('resolves with the first record found', async () => {
      expect(result.version_id).to.equal('test-version-id');
    });
  });

  experiment('.getLines', () => {
    let result;

    beforeEach(async () => {
      result = await apiConnector.getLines('test-version-id');
    });

    test('calls the API connector with the correct filter and sort params', async () => {
      const [filter, sort] = returnsApiConnector.lines.findAll.lastCall.args;
      expect(filter).to.equal({
        version_id: 'test-version-id'
      });
      expect(sort).to.equal({
        start_date: +1
      });
    });

    test('resolves with all records found', async () => {
      expect(result).to.be.an.array().length(1);
      expect(result[0].line_id).to.equal('test-line-id');
    });
  });
});
