const Lab = require('lab');
const { experiment, test } = exports.lab = Lab.script();
const { expect } = require('code');

const {
  getContacts
} = require('../../../src/modules/contacts/index.js');

const data = require('./licence.json');

experiment('getContacts', () => {
  test('It should get contacts for a particular licence', async () => {
    const result = await getContacts('6/33/20/*S/0123');
    console.log(result);
  });
});
