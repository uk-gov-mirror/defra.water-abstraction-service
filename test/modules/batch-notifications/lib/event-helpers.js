const { expect } = require('@hapi/code');
const {
  beforeEach,
  experiment,
  test,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const queries = require('../../../../src/modules/batch-notifications/lib/queries');
const { createEvent, updateEventStatus, markAsProcessed, refreshEventStatus } =
require('../../../../src/modules/batch-notifications/lib/event-helpers');
const { EVENT_STATUS_PROCESSING, EVENT_STATUS_PROCESSED, EVENT_STATUS_SENDING, EVENT_STATUS_COMPLETED } =
require('../../../../src/modules/batch-notifications/lib/event-statuses');
const { MESSAGE_STATUS_SENT, MESSAGE_STATUS_ERROR } =
require('../../../../src/modules/batch-notifications/lib/message-statuses');
const evt = require('../../../../src/lib/event');

const issuer = 'mail@example.com';
const config = {
  messageType: 'testType',
  prefix: 'TEST-',
  name: 'My test'
};
const options = {
  foo: 'bar'
};

const eventKeys = [
  'eventId',
  'referenceCode',
  'type',
  'subtype',
  'issuer',
  'licences',
  'entities',
  'comment',
  'metadata',
  'status',
  'created',
  'modified' ];

experiment('batch notifications event helpers', () => {
  beforeEach(async () => {
    sandbox.stub(evt, 'save');
    sandbox.stub(evt, 'load').resolves({
      eventId: 'testEventId',
      status: 'testStatus',
      type: 'notification',
      metadata: {
        foo: 'bar'
      }
    });
    sandbox.stub(queries, 'getMessageStatuses').resolves([
      { status: MESSAGE_STATUS_SENT, count: 5 },
      { status: MESSAGE_STATUS_ERROR, count: 2 }
    ]);
  });

  afterEach(async () => {
    sandbox.restore();
  });

  experiment('createEvent ', () => {
    let createdEvent;

    experiment('should create an event', () => {
      beforeEach(async () => {
        sandbox.stub(evt, 'create');
        await createEvent(issuer, config, options);
        createdEvent = evt.create.lastCall.args[0];
      });

      test('with a reference code using the prefix in the notification config', async () => {
        expect(createdEvent.referenceCode).to.startWith('TEST-');
      });

      test('with a type of "notification"', async () => {
        expect(createdEvent.type).to.equal('notification');
      });

      test('with a subtype using the messageType in the notification config', async () => {
        expect(createdEvent.subtype).to.equal(config.messageType);
      });

      test('with the issuer passed in', async () => {
        expect(createdEvent.issuer).to.equal(issuer);
      });

      test('with the correct metadata', async () => {
        expect(createdEvent.metadata).to.equal({
          name: config.name,
          options
        });
      });

      test('with a status of "processing"', async () => {
        expect(createdEvent.status).to.equal(EVENT_STATUS_PROCESSING);
      });
    });

    test('saves the created event', async () => {
      await createEvent(issuer, config, options);
      expect(evt.save.callCount).to.equal(1);
      const keys = Object.keys(evt.save.lastCall.args[0]);
      expect(keys).to.include(eventKeys);
    });

    test('returns the created event', async () => {
      const result = await createEvent(issuer, config, options);
      const keys = Object.keys(result);
      expect(keys).to.include(eventKeys);
    });
  });

  experiment('updateEventStatus', () => {
    test('should load the event with the supplied ID', async () => {
      await updateEventStatus('testEventId', 'newStatus');
      expect(evt.load.firstCall.args[0]).to.equal('testEventId');
    });

    test('should save the event with the new status', async () => {
      await updateEventStatus('testEventId', 'newStatus');
      const [ ev ] = evt.save.firstCall.args;
      expect(ev.eventId).to.equal('testEventId');
      expect(ev.status).to.equal('newStatus');
    });

    test('should return the updated event', async () => {
      const result = await updateEventStatus('testEventId', 'newStatus');
      expect(result.eventId).to.equal('testEventId');
    });
  });

  experiment('markAsProcessed', () => {
    const licenceNumbers = ['01/123', '04/567'];
    const recipients = 10;

    test('should load the event with the supplied ID', async () => {
      await markAsProcessed('testEventId', licenceNumbers, recipients);
      expect(evt.load.firstCall.args[0]).to.equal('testEventId');
    });

    test('should mark the event as processed', async () => {
      await markAsProcessed('testEventId', licenceNumbers, recipients);
      const [ ev ] = evt.save.lastCall.args;
      expect(ev.status).to.equal(EVENT_STATUS_PROCESSED);
    });

    test('should record the affected licence numbers', async () => {
      await markAsProcessed('testEventId', licenceNumbers, recipients);
      const [ ev ] = evt.save.lastCall.args;
      expect(ev.licences).to.equal(licenceNumbers);
    });

    test('should update the event metadata', async () => {
      await markAsProcessed('testEventId', licenceNumbers, recipients);
      const [ ev ] = evt.save.lastCall.args;
      expect(ev.metadata.sent).to.equal(0);
      expect(ev.metadata.error).to.equal(0);
      expect(ev.metadata.recipients).to.equal(recipients);
    });

    test('should not alter existing metadata', async () => {
      await markAsProcessed('testEventId', licenceNumbers, recipients);
      const [ ev ] = evt.save.lastCall.args;
      expect(ev.metadata.foo).to.equal('bar');
    });
  });

  experiment('refreshEventStatus', () => {
    test('loads the event with the specified ID', async () => {
      await refreshEventStatus('testId');
      expect(evt.load.firstCall.args[0]).to.equal('testId');
    });

    test('should not update the event unless status is "sending"', async () => {
      evt.load.resolves({
        status: 'wrongStatus'
      });
      await refreshEventStatus('testId');
      expect(evt.save.callCount).to.equal(0);
    });

    test('updates the event when status is "sending"', async () => {
      evt.load.resolves({
        metadata: {
          recipients: 8
        },
        status: EVENT_STATUS_SENDING
      });

      await refreshEventStatus('testId');

      const [ ev ] = evt.save.lastCall.args;

      expect(ev.status).to.equal(EVENT_STATUS_SENDING);
      expect(ev.metadata.sent).to.equal(5);
      expect(ev.metadata.error).to.equal(2);
    });

    test('updates event status to "completed" when all messages are sent/errored', async () => {
      evt.load.resolves({
        metadata: {
          recipients: 7
        },
        status: EVENT_STATUS_SENDING
      });

      await refreshEventStatus('testId');

      const [ ev ] = evt.save.lastCall.args;
      expect(ev.status).to.equal(EVENT_STATUS_COMPLETED);
    });

    test('resolves with the event object', async () => {
      const result = await refreshEventStatus('testId');
      expect(result).to.be.an.object();
      expect(result.eventId).to.equal('testEventId');
    });
  });
});
