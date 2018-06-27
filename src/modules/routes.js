const notificationsRoutes = require('./notifications/routes');
const riverLevelsRoutes = require('./river-levels/routes');
const notifyRoutes = require('./notify/routes');
const dataStoreRoutes = require('./data-store/routes');

module.exports = [
  ...Object.values(notificationsRoutes),
  ...Object.values(notifyRoutes),
  ...Object.values(riverLevelsRoutes),
  ...Object.values(dataStoreRoutes)
];
