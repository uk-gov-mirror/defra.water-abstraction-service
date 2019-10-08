const Joi = require('joi');
const controller = require('./controller');

module.exports = {
  previewCharge: {
    method: 'GET',
    path: '/water/1.0/charging/preview/{chargeVersionId}',
    handler: controller.getPreviewCharge,
    options: {
      validate: {
        params: {
          chargeVersionId: Joi.string().guid().required()
        },
        query: {
          financialYear: Joi.number().integer().positive().required(),
          twoPartTariff: Joi.boolean().default(false),
          summer: Joi.when('twoPartTariff', { is: true,
            then: Joi.boolean().required()
          })
        }
      }
    }
  }
};
