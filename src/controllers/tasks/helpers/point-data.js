/**
 * @module controllers/tasks/helpers/point-data
 */
const ngrConverter = require('./ngr-converter');

function getPointLatLong (east, north) {
  if (east === 'NULL' || north === 'NULL') {
    return null;
  }

  // Reduce map resolution
  const east2 = Number.parseFloat(east).toPrecision(4);
  const north2 = Number.parseFloat(north).toPrecision(4);
  return ngrConverter(east2, north2);
}

/**
 * Get an array of purpose points from the currentVersion property
 * of a licence
 * There are up to 4 points per purpose point, and these are each
 * represented as {latitide, longitude}
 * @param {Object} currentVersion
 * @return {Array} points array
 */
function getLicencePoints (currentVersion) {
  const points = [];

  currentVersion.purposes.forEach((purpose) => {
    purpose.purposePoints.forEach((purposePoint) => {
      const {CART1_EAST, CART1_NORTH} = purposePoint.point_detail;
      const {CART2_EAST, CART2_NORTH} = purposePoint.point_detail;
      const {CART3_EAST, CART3_NORTH} = purposePoint.point_detail;
      const {CART4_EAST, CART4_NORTH} = purposePoint.point_detail;

      if (CART1_EAST !== 'null') {
        points.push(getPointLatLong(CART1_EAST, CART1_NORTH));
      }
      if (CART2_EAST !== 'null') {
        points.push(getPointLatLong(CART2_EAST, CART2_NORTH));
      }
      if (CART3_EAST !== 'null') {
        points.push(getPointLatLong(CART3_EAST, CART3_NORTH));
      }
      if (CART4_EAST !== 'null') {
        points.push(getPointLatLong(CART4_EAST, CART4_NORTH));
      }
    });
  });

  return points;
}

module.exports = {
  getLicencePoints
};
