const rp = require('request-promise-native').defaults({
  proxy: null,
  strictSSL: false
});

const { APIClient } = require('@envage/hapi-pg-rest-api');

const usersClient = new APIClient(rp, {
  endpoint: process.env.IDM_URI + '/user',
  headers: {
    Authorization: process.env.JWT_TOKEN
  }
});

usersClient.getUsersByExternalId = async externalIds => {
  return usersClient.findMany({
    external_id: { $in: externalIds }
  });
};

module.exports = {
  usersClient
};
