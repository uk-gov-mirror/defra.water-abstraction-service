'use strict';

const uuid = require('uuid/v4');
const {
  afterEach,
  beforeEach,
  experiment,
  test
} = exports.lab = require('@hapi/lab').script();
const { expect } = require('@hapi/code');
const sandbox = require('sinon').createSandbox();

const notifyConnector = require('../../../src/lib/connectors/notify');
const scheduledNotificationService = require('../../../src/lib/services/scheduled-notifications');
const pdfGenerator = require('../../../src/lib/services/pdf-generation/pdf');

const notify = require('../../../src/lib/notify');

experiment('src/lib/notify/index', () => {
  beforeEach(async () => {
    sandbox.stub(scheduledNotificationService, 'getScheduledNotificationById');
    sandbox.stub(pdfGenerator, 'createPdfFromScheduledNotification');
    sandbox.stub(notifyConnector, 'getClient');
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('getNotifyKey', () => {
    test('The API should get test notify key', async () => {
      expect(notify.getNotifyKey('test')).to.equal(process.env.TEST_NOTIFY_KEY);
    });

    test('The API should get whitelist notify key', async () => {
      expect(notify.getNotifyKey('whitelist')).to.equal(process.env.WHITELIST_NOTIFY_KEY);
    });

    test('The API should get live notify key', async () => {
      expect(notify.getNotifyKey('live')).to.equal(process.env.LIVE_NOTIFY_KEY);
    });

    test('The API should use a custom notify key', async () => {
      expect(notify.getNotifyKey('some-other-key')).to.equal('some-other-key');
    });
  });

  experiment('getPdfNotifyKey', () => {
    let env;

    beforeEach(async () => {
      env = {
        TEST_NOTIFY_KEY: 'test-key',
        LIVE_NOTIFY_KEY: 'live-key'
      };
    });

    test('returns the test key for the local environment', async () => {
      const localEnv = { ...env, NODE_ENV: 'local' };
      expect(notify.getPdfNotifyKey(localEnv)).to.equal('test-key');
    });

    test('returns the test key for the test environment', async () => {
      const testEnv = { ...env, NODE_ENV: 'test' };
      expect(notify.getPdfNotifyKey(testEnv)).to.equal('test-key');
    });

    test('returns the test key for the preprod environment', async () => {
      const preprodEnv = { ...env, NODE_ENV: 'preprod' };
      expect(notify.getPdfNotifyKey(preprodEnv)).to.equal('test-key');
    });

    test('returns the live key for production only', async () => {
      const productionEnv = { ...env, NODE_ENV: 'production' };
      expect(notify.getPdfNotifyKey(productionEnv)).to.equal('live-key');
    });
  });

  experiment('sendPdf', () => {
    let notificationId;
    let notifyId;
    let notification;
    let pdf;
    let notifyClient;

    beforeEach(async () => {
      notificationId = uuid();
      notifyId = uuid();
      pdf = 'test-pdf-stub';

      notification = { id: notificationId };

      notifyClient = {
        sendPrecompiledLetter: sandbox.spy()
      };

      notifyConnector.getClient.returns(notifyClient);
      scheduledNotificationService.getScheduledNotificationById.resolves(notification);
      pdfGenerator.createPdfFromScheduledNotification.resolves(pdf);

      await notify.sendPdf(notificationId, notifyId);
    });

    test('gets the notification using the id', async () => {
      const [id] = scheduledNotificationService.getScheduledNotificationById.lastCall.args;
      expect(id).to.equal(notificationId);
    });

    test('uses the returned notification to generate the pdf', async () => {
      const [model] = pdfGenerator.createPdfFromScheduledNotification.lastCall.args;
      expect(model).to.equal(notification);
    });

    test('sends the letter', async () => {
      const [messageType] = notifyConnector.getClient.lastCall.args;
      expect(messageType).to.equal(notifyConnector.messageTypes.letter);

      const [id, data] = notifyClient.sendPrecompiledLetter.lastCall.args;
      expect(id).to.equal(notifyId);
      expect(data).to.equal(pdf);
    });
  });
});
