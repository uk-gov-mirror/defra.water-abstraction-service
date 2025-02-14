'use strict';

const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();
const { expect } = require('@hapi/code');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const request = require('../../../../src/lib/connectors/charge-module/request');
const billRunsApiConnector = require('../../../../src/lib/connectors/charge-module/bill-runs');

experiment('lib/connectors/charge-module/bill-runs', () => {
  beforeEach(async () => {
    sandbox.stub(request, 'get').resolves();
    sandbox.stub(request, 'post').resolves();
    sandbox.stub(request, 'patch').resolves();
    sandbox.stub(request, 'delete').resolves();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.create', () => {
    beforeEach(async () => {
      await billRunsApiConnector.create('A');
    });

    test('the method is POST', async () => {
      expect(request.post.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.post.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs');
    });

    test('the region is included in the payload', async () => {
      const [, payload] = request.post.lastCall.args;
      expect(payload).to.equal({ region: 'A' });
    });
  });

  experiment('.addTransaction', () => {
    beforeEach(async () => {
      await billRunsApiConnector.addTransaction('test-id', { foo: 'bar' });
    });

    test('the method is POST', async () => {
      expect(request.post.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.post.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id/transactions');
    });

    test('the transaction is included in the payload', async () => {
      const [, payload] = request.post.lastCall.args;
      expect(payload).to.equal({ foo: 'bar' });
    });
  });

  experiment('.approve', () => {
    beforeEach(async () => {
      await billRunsApiConnector.approve('test-id');
    });

    test('the method is PATCH', async () => {
      expect(request.patch.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.patch.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id/approve');
    });
  });

  experiment('.send', () => {
    beforeEach(async () => {
      await billRunsApiConnector.send('test-id');
    });

    test('the method is PATCH', async () => {
      expect(request.patch.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.patch.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id/send');
    });
  });

  experiment('.deleteInvoiceFromBillRun', () => {
    beforeEach(async () => {
      await billRunsApiConnector.deleteInvoiceFromBillRun('test-id', 'test-other-id');
    });

    test('the method is DELETE', async () => {
      expect(request.delete.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.delete.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id/invoices/test-other-id');
    });
  });

  experiment('.delete', () => {
    beforeEach(async () => {
      await billRunsApiConnector.delete('test-id');
    });

    test('the method is DELETE', async () => {
      expect(request.delete.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.delete.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id');
    });
  });

  experiment('.get', () => {
    beforeEach(async () => {
      await billRunsApiConnector.get('test-id');
    });

    test('the method is GET', async () => {
      expect(request.get.called).to.be.true();
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.get.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id');
    });
  });

  experiment('.getInvoiceTransactions', () => {
    beforeEach(async () => {
      await billRunsApiConnector.getInvoiceTransactions('test-id', 'test-invoice-id');
    });

    test('the correct endpoint is called', async () => {
      const [path] = request.get.lastCall.args;
      expect(path).to.equal('v2/wrls/bill-runs/test-id/invoices/test-invoice-id');
    });
  });
});
