const {
  experiment,
  test,
  beforeEach,
  afterEach
} = exports.lab = require('@hapi/lab').script();
const { expect } = require('@hapi/code');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const transactionsService = require('../../../../src/modules/billing/services/transactions-service');
const chargeModuleTransactionsConnector = require('../../../../src/lib/connectors/charge-module/transactions');
const ChargeModuleTransaction = require('../../../../src/lib/models/charge-module-transaction');
const InvoiceLicence = require('../../../../src/lib/models/invoice-licence');
const Transaction = require('../../../../src/lib/models/transaction');
const ChargeElement = require('../../../../src/lib/models/charge-element');
const AbstractionPeriod = require('../../../../src/lib/models/abstraction-period');
const DateRange = require('../../../../src/lib/models/date-range');

const createChargeElement = () => {
  const chargeElement = new ChargeElement('29328315-9b24-473b-bde7-02c60e881501');
  chargeElement.fromHash({
    source: 'supported',
    season: 'summer',
    loss: 'low',
    authorisedAnnualQuantity: '12.5',
    billableAnnualQuantity: '10'
  });
  chargeElement.abstractionPeriod = new AbstractionPeriod();
  chargeElement.abstractionPeriod.fromHash({
    startDay: 1,
    startMonth: 1,
    endDay: 31,
    endMonth: 12
  });
  return chargeElement;
};

const createTransaction = (options = {}) => {
  const transaction = new Transaction();
  transaction.fromHash({
    chargeElement: createChargeElement(),
    chargePeriod: new DateRange('2019-04-01', '2020-03-31'),
    isCredit: false,
    isCompensationCharge: !!options.isCompensationCharge,
    authorisedDays: 366,
    billableDays: 366,
    description: 'Tiny pond'
  });
  return transaction;
};

const createInvoiceLicence = (options = {}) => {
  const invoiceLicence = new InvoiceLicence('c4fd4bf6-9565-4ff8-bdba-e49355446d7b');
  invoiceLicence.transactions = [
    createTransaction(options)
  ];
  return invoiceLicence;
};

experiment('modules/billing/services/transactions-service', () => {
  let transactions;

  beforeEach(async () => {
    transactions = [
      {
        id: '782cdbcb-8975-4058-bccf-932f36af678a',
        customerReference: 'A11223344A',
        batchNumber: 'ABC1',
        licenceNumber: '123/ABC',
        twoPartTariff: false,
        chargeValue: 6134,
        credit: false,
        transactionStatus: 'unbilled',
        approvedForBilling: false
      },
      {
        id: '888fa748-4b1c-4466-ad07-4d7705728da0',
        customerReference: 'A55667788A',
        batchNumber: 'ABC1',
        licenceNumber: '123/ABC',
        twoPartTariff: false,
        chargeValue: -1421,
        credit: true,
        transactionStatus: 'unbilled',
        approvedForBilling: false
      }
    ];

    sandbox.stub(chargeModuleTransactionsConnector, 'getTransactionQueue').resolves({
      pagination: { page: 1, perPage: 50, pageCount: 1, recordCount: 2 },
      data: {
        transactions
      }
    });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('.getTransactionsForBatch', () => {
    let result;

    beforeEach(async () => {
      result = await transactionsService.getTransactionsForBatch('test-batch-id');
    });

    test('calls the connector code with the batch id', async () => {
      const [batchId] = chargeModuleTransactionsConnector.getTransactionQueue.lastCall.args;
      expect(batchId).to.equal('test-batch-id');
    });

    test('returns an array of ChargeModuleTransaction objects', async () => {
      expect(result).to.be.an.array();
      expect(result[0]).to.be.an.instanceOf(ChargeModuleTransaction);
      expect(result[1]).to.be.an.instanceOf(ChargeModuleTransaction);
    });

    test('the transactions have the expected data', async () => {
      const transaction = result[0];
      expect(transaction.id).to.equal(transactions[0].id);
      expect(transaction.licenceNumber).to.equal(transactions[0].licenceNumber);
      expect(transaction.accountNumber).to.equal(transactions[0].customerReference);
      expect(transaction.isCredit).to.equal(transactions[0].credit);
      expect(transaction.value).to.equal(transactions[0].chargeValue);
    });
  });

  experiment('.getTransactionsForBatchInvoice', () => {
    let result;

    beforeEach(async () => {
      result = await transactionsService.getTransactionsForBatchInvoice('test-batch-id', 'test-customer');
    });

    test('calls the connector code with the batch id and customer reference', async () => {
      const [, customerRef] = chargeModuleTransactionsConnector.getTransactionQueue.lastCall.args;
      expect(customerRef).to.equal('test-customer');
    });

    test('returns an array of ChargeModuleTransaction objects', async () => {
      expect(result).to.be.an.array();
      expect(result[0]).to.be.an.instanceOf(ChargeModuleTransaction);
      expect(result[1]).to.be.an.instanceOf(ChargeModuleTransaction);
    });

    test('the transactions have the expected data', async () => {
      const transaction = result[0];
      expect(transaction.id).to.equal(transactions[0].id);
      expect(transaction.licenceNumber).to.equal(transactions[0].licenceNumber);
      expect(transaction.accountNumber).to.equal(transactions[0].customerReference);
      expect(transaction.isCredit).to.equal(transactions[0].credit);
      expect(transaction.value).to.equal(transactions[0].chargeValue);
    });
  });

  experiment('.mapChargeToTransactions', () => {
    let result;

    const chargeLine = {
      startDate: '2018-04-01',
      endDate: '2019-03-31',
      section127Agreement: true,
      chargeElements: [{
        chargeElementId: 'bf679fc9-dec9-42cd-bc32-542578be01d9',
        source: 'supported',
        season: 'summer',
        loss: 'low',
        totalDays: 365,
        billableDays: 200,
        description: 'Tiny pond',
        abstractionPeriodStartDay: 1,
        abstractionPeriodStartMonth: 2,
        abstractionPeriodEndDay: 3,
        abstractionPeriodEndMonth: 4
      }]
    };

    experiment('when a compensation charge is applicable', () => {
      beforeEach(async () => {
        result = transactionsService.mapChargeToTransactions(chargeLine, {}, true);
      });

      test('2 transactions are created', async () => {
        expect(result).to.be.an.array().length(2);
      });

      experiment('the first transaction', () => {
        test('is a standard charge', async () => {
          expect(result[0].isCompensationCharge).to.be.false();
        });

        test('is not two-part tariff supplementary charge by default', async () => {
          expect(result[0].isTwoPartTariffSupplementaryCharge).to.equal(false);
        });

        test('is not a credit', async () => {
          expect(result[0].isCredit).to.equal(false);
        });

        test('has the correct billable and authorised days', async () => {
          expect(result[0].authorisedDays).to.equal(chargeLine.chargeElements[0].totalDays);
          expect(result[0].billableDays).to.equal(chargeLine.chargeElements[0].billableDays);
        });

        test('has the correct description', async () => {
          expect(result[0].description).to.equal(chargeLine.chargeElements[0].description);
        });

        test('has the charge period mapped correctly', async () => {
          expect(result[0].chargePeriod.startDate).to.equal(chargeLine.startDate);
          expect(result[0].chargePeriod.endDate).to.equal(chargeLine.endDate);
        });

        test('has the charge element mapped correctly', async () => {
          const { chargeElement } = result[0];
          expect(chargeElement.id).to.equal(chargeLine.chargeElements[0].chargeElementId);
          expect(chargeElement.source).to.equal(chargeLine.chargeElements[0].source);
          expect(chargeElement.season).to.equal(chargeLine.chargeElements[0].season);
          expect(chargeElement.loss).to.equal(chargeLine.chargeElements[0].loss);
        });

        test('has the abstraction period mapped correctly', async () => {
          const { abstractionPeriod } = result[0].chargeElement;
          expect(abstractionPeriod.startDay).to.equal(chargeLine.chargeElements[0].abstractionPeriodStartDay);
          expect(abstractionPeriod.startMonth).to.equal(chargeLine.chargeElements[0].abstractionPeriodStartMonth);
          expect(abstractionPeriod.endDay).to.equal(chargeLine.chargeElements[0].abstractionPeriodEndDay);
          expect(abstractionPeriod.endMonth).to.equal(chargeLine.chargeElements[0].abstractionPeriodEndMonth);
        });

        test('has agreements mapped correctly', async () => {
          const { agreements } = result[0];
          expect(agreements).to.be.an.array().length(1);
          expect(agreements[0].code).to.equal('127');
        });
      });

      experiment('the second transaction', () => {
        test('is a compensation charge', async () => {
          expect(result[1].isCompensationCharge).to.be.true();
        });
      });
    });

    experiment('when a compensation charge is not applicable', () => {
      beforeEach(async () => {
        result = transactionsService.mapChargeToTransactions(chargeLine, {}, false);
      });

      test('1 transaction is created', async () => {
        expect(result).to.be.an.array().length(1);
      });

      experiment('the first transaction', () => {
        test('is a standard charge', async () => {
          expect(result[0].isCompensationCharge).to.be.false();
        });
      });
    });

    experiment('when processing two-part tariff supplementary', () => {
      beforeEach(async () => {
        result = transactionsService.mapChargeToTransactions(chargeLine, { isTwoPartTariffSupplementaryCharge: true }, false);
      });

      test('1 transactions is created', async () => {
        expect(result).to.be.an.array().length(1);
      });

      test('the transaction is a standard charge', async () => {
        expect(result[0].isCompensationCharge).to.be.false();
      });

      test('the transaction is a two-part tariff supplementary charge', async () => {
        expect(result[0].isTwoPartTariffSupplementaryCharge).to.be.true();
      });
    });
  });

  experiment('.mapTransactionToDB', () => {
    let invoiceLicence, result;

    experiment('when the transaction is a standard charge', () => {
      beforeEach(async () => {
        invoiceLicence = createInvoiceLicence();
        result = transactionsService.mapTransactionToDB(invoiceLicence, invoiceLicence.transactions[0]);
      });

      test('the result is mapped correctly', async () => {
        expect(result).to.equal({
          billing_invoice_licence_id: 'c4fd4bf6-9565-4ff8-bdba-e49355446d7b',
          charge_element_id: '29328315-9b24-473b-bde7-02c60e881501',
          start_date: '2019-04-01',
          end_date: '2020-03-31',
          abstraction_period: {
            startDay: 1,
            startMonth: 1,
            endDay: 31,
            endMonth: 12
          },
          source: 'supported',
          loss: 'low',
          season: 'summer',
          is_credit: false,
          charge_type: 'standard',
          authorised_quantity: 12.5,
          billable_quantity: 10,
          authorisedDays: 366,
          billableDays: 366,
          description: 'Tiny pond'
        });
      });
    });

    experiment('when the transaction is a compensation charge', () => {
      beforeEach(async () => {
        invoiceLicence = createInvoiceLicence({
          isCompensationCharge: true
        });
        result = transactionsService.mapTransactionToDB(invoiceLicence, invoiceLicence.transactions[0]);
      });

      test('the charge type is "compensation"', async () => {
        expect(result.charge_type).to.equal('compensation');
      });
    });
  });
});
