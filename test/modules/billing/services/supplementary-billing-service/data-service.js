'use strict';

const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();
const { expect } = require('@hapi/code');
const uuid = require('uuid/v4');
const sandbox = require('sinon').createSandbox();
const { pick } = require('lodash');

const billingTransactionsRepo = require('../../../../../src/lib/connectors/repos/billing-transactions');
const dataService = require('../../../../../src/modules/billing/services/supplementary-billing-service/data-service');
const invoiceService = require('../../../../../src/lib/services/invoice-service');
const invoiceLicenceService = require('../../../../../src/modules/billing/services/invoice-licences-service');

// Models
const Invoice = require('../../../../../src/lib/models/invoice');
const InvoiceLicence = require('../../../../../src/lib/models/invoice-licence');

const { actions } = require('../../../../../src/modules/billing/services/supplementary-billing-service/constants');

const batchId = uuid();

const { createTransaction } = require('./test-helpers');

experiment('modules/billing/services/supplementary-billing-service/data-service', () => {
  let result;

  beforeEach(async () => {
    sandbox.stub(billingTransactionsRepo, 'findByBatchId');
    sandbox.stub(billingTransactionsRepo, 'findHistoryByBatchId');
    sandbox.stub(billingTransactionsRepo, 'create');
    sandbox.stub(billingTransactionsRepo, 'delete');

    sandbox.stub(invoiceService, 'getOrCreateInvoice');
    sandbox.stub(invoiceLicenceService, 'getOrCreateInvoiceLicence');
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.getTransactions', async () => {
    let transactions;
    beforeEach(async () => {
      transactions = {
        current: [createTransaction(batchId, uuid())],
        historical: [createTransaction('historical', uuid())]
      };
      billingTransactionsRepo.findByBatchId.resolves(transactions.current);
      billingTransactionsRepo.findHistoryByBatchId.resolves(transactions.historical);
      result = await dataService.getTransactions(batchId);
    });

    test('calls finds the current batch transactions', async () => {
      expect(billingTransactionsRepo.findByBatchId.calledWith(batchId)).to.be.true();
    });

    test('calls finds the historical transactions', async () => {
      expect(billingTransactionsRepo.findHistoryByBatchId.calledWith(batchId)).to.be.true();
    });

    test('resolves with all the transactions in a flat array', async () => {
      expect(result).to.be.an.array().length(2);
      expect(result).to.equal([
        transactions.current[0],
        transactions.historical[0]
      ]);
    });
  });

  experiment('.persistChanges', () => {
    experiment('when passed an empty transactions array', () => {
      beforeEach(async () => {
        await dataService.persistChanges(batchId, []);
      });

      test('no transactions are deleted', async () => {
        expect(billingTransactionsRepo.delete.called).to.be.false();
      });

      test('no transactions are created', async () => {
        expect(billingTransactionsRepo.create.called).to.be.false();
      });
    });

    experiment('when passed transactions for deletion', () => {
      let transactions;

      beforeEach(async () => {
        transactions = [
          createTransaction(batchId, uuid(), { action: actions.deleteTransaction }),
          createTransaction(batchId, uuid()),
          createTransaction(batchId, uuid(), { action: actions.deleteTransaction })
        ];
        await dataService.persistChanges(batchId, transactions);
      });

      test('only transactions marked for deletion are deleted', async () => {
        expect(billingTransactionsRepo.delete.callCount).to.equal(1);
        expect(billingTransactionsRepo.delete.calledWith([
          transactions[0].billingTransactionId,
          transactions[2].billingTransactionId
        ])).to.be.true();
      });

      test('no transactions are created', async () => {
        expect(billingTransactionsRepo.create.called).to.be.false();
      });
    });

    experiment('when passed transactions for reversal', () => {
      let transactions;

      const invoice = new Invoice(uuid());
      const invoiceLicence = new InvoiceLicence(uuid());

      beforeEach(async () => {
        invoiceService.getOrCreateInvoice.resolves(invoice);
        invoiceLicenceService.getOrCreateInvoiceLicence.resolves(invoiceLicence);

        transactions = [
          createTransaction(batchId, uuid(), { action: actions.reverseTransaction, isCredit: false }),
          createTransaction(batchId, uuid())
        ];

        await dataService.persistChanges(batchId, transactions);
      });

      test('no transactions are deleted', async () => {
        expect(billingTransactionsRepo.delete.called).to.be.false();
      });

      test('the invoice is fetched/created', async () => {
        expect(invoiceService.getOrCreateInvoice.callCount).to.equal(1);
        expect(invoiceService.getOrCreateInvoice.calledWith(
          batchId,
          transactions[0].invoiceAccountId,
          transactions[0].financialYearEnding
        )).to.be.true();
      });

      test('the invoice licence is fetched/created', async () => {
        expect(invoiceLicenceService.getOrCreateInvoiceLicence.callCount).to.equal(1);
        expect(invoiceLicenceService.getOrCreateInvoiceLicence.calledWith(
          invoice.id,
          transactions[0].licenceId,
          transactions[0].licenceRef
        )).to.be.true();
      });

      test('transactions are created to reverse historical ones', async () => {
        expect(billingTransactionsRepo.create.callCount).to.equal(1);
        const [createdTransaction] = billingTransactionsRepo.create.lastCall.args;

        const matchingKeys = [
          'chargeElementId',
          'startDate',
          'endDate',
          'abstractionPeriod',
          'netAmount',
          'authorisedQuantity',
          'billableQuantity',
          'authorisedDays',
          'billableDays',
          'description',
          'source',
          'season',
          'loss',
          'chargeType',
          'volume',
          'section126Factor',
          'section127Agreement',
          'section130Agreement',
          'isTwoPartTariffSupplementary',
          'calculatedVolume',
          'twoPartTariffError',
          'twoPartTariffStatus',
          'twoPartTariffReview',
          'isDeMinimis',
          'isNewLicence'
        ];

        expect(pick(transactions[0], matchingKeys)).to.equal(pick(createdTransaction, matchingKeys));

        expect(createdTransaction.billingInvoiceLicenceId).to.equal(invoiceLicence.id);
        expect(createdTransaction.sourceTransactionId).to.equal(transactions[0].billingTransactionId);
        expect(createdTransaction.status).to.equal('candidate');
        expect(createdTransaction.legacyId).to.be.null();
        expect(createdTransaction.externalId).to.be.null();
        expect(createdTransaction.isCredit).to.be.true();
      });
    });
  });
});
