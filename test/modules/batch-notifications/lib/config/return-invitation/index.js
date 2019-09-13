const { expect } = require('@hapi/code');
const {
  beforeEach,
  experiment,
  test,
  afterEach
} = exports.lab = require('@hapi/lab').script();

const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const Joi = require('@hapi/joi');

const config = require('../../../../../../src/modules/batch-notifications/config/return-invitation');
const scheduledNotifications = require('../../../../../../src/controllers/notifications');
const eventHelpers = require('../../../../../../src/modules/batch-notifications/lib/event-helpers');

const Contact = require('../../../../../../src/lib/models/contact');

const notificationContacts = require('../../../../../../src/modules/batch-notifications/config/return-invitation/return-notification-contacts');
const notificationRecipients = require('../../../../../../src/modules/batch-notifications/config/return-invitation/return-notification-recipients');
const { logger } = require('../../../../../../src/logger');

experiment('return invitation config', () => {
  test('has the correct prefix', async () => {
    expect(config.prefix).to.equal('RINV-');
  });

  test('has the correct name', async () => {
    expect(config.name).to.equal('Returns: invitation');
  });

  test('has the correct message type', async () => {
    expect(config.messageType).to.equal('returnInvitation');
  });

  experiment('schema', () => {
    test('can be an empty object', async () => {
      const { error } = Joi.validate({}, config.schema);
      expect(error).to.equal(null);
    });

    test('can contain an array of licence numbers to exclude from the notification', async () => {
      const { error } = Joi.validate({
        excludeLicences: ['01/123', '04/567']
      }, config.schema);
      expect(error).to.equal(null);
    });
  });

  experiment('getRecipients', () => {
    const jobData = {
      ev: {
        eventId: 'event_1',
        metadata: {
          options: {
            excludeLicences: ['01/123']
          }
        }
      }
    };

    beforeEach(async () => {
      sandbox.stub(notificationContacts, 'getReturnContacts');
      sandbox.stub(notificationRecipients, 'getRecipientList').returns([
        {
          contact: new Contact({
            email: 'john@example.com',
            firstName: 'John',
            name: 'Doe',
            type: Contact.CONTACT_TYPE_PERSON,
            role: Contact.CONTACT_ROLE_PRIMARY_USER
          }),
          licenceNumbers: ['01/123'],
          returnIds: ['1:01/123:12345:2018-01-01:2019-01-01']
        }
      ]);

      sandbox.stub(scheduledNotifications.repository, 'create').resolves();
      sandbox.stub(eventHelpers, 'markAsProcessed');
      sandbox.stub(logger, 'error');
    });

    afterEach(async () => {
      sandbox.restore();
    });

    test('finds due returns and contacts excluding any specified licence numbers', async () => {
      await config.getRecipients(jobData);
      expect(notificationContacts.getReturnContacts.callCount).to.equal(1);
      const [ excluded ] = notificationContacts.getReturnContacts.lastCall.args;
      expect(excluded).to.equal(['01/123']);
    });

    test('maps and de-duplicates recipient list', async () => {
      await config.getRecipients(jobData);
      expect(notificationRecipients.getRecipientList.callCount).to.equal(1);
    });

    test('schedules a message for each de-duped contact', async () => {
      await config.getRecipients(jobData);
      expect(scheduledNotifications.repository.create.callCount).to.equal(1);

      const [row] = scheduledNotifications.repository.create.lastCall.args;

      expect(Object.keys(row)).to.only.include([
        'message_ref',
        'id',
        'event_id',
        'licences',
        'metadata',
        'status',
        'message_type',
        'recipient',
        'personalisation' ]
      );
    });

    test('updates event with licences affected and recipient count', async () => {
      await config.getRecipients(jobData);
      expect(eventHelpers.markAsProcessed.callCount).to.equal(1);
      const [eventId, licenceNumbers, count] = eventHelpers.markAsProcessed.lastCall.args;
      expect(eventId).to.equal('event_1');
      expect(licenceNumbers).to.equal(['01/123']);
      expect(count).to.equal(1);
    });

    test('logs an error if a message has no contact object', async () => {
      notificationRecipients.getRecipientList.returns([
        {
          licenceNumbers: ['01/123'],
          returnIds: ['1:01/123:12345:2018-01-01:2019-01-01']
        }
      ]);
      await config.getRecipients(jobData);
      expect(logger.error.callCount).to.equal(1);
    });
  });
});
