/**
 * A function to convert NGR grid in coordinates in easting/northings
 * to latitude and longitude
 * @see {@link https://stackoverflow.com/questions/4107806/sql-function-to-convert-uk-os-coordinates-from-easting-northing-to-longitude-and}
 */
function toDeg (val) { // convert radians to degrees (signed)
  return val * 180 / Math.PI;
}

/**
 * @param {Number} E - eastings
 * @param {Number} N - northings
 * @return {Object} latitude/longitude
 */
function OSGridToLatLong (E, N) {
  var a = 6377563.396, b = 6356256.910; // Airy 1830 major & minor semi-axes
  var F0 = 0.9996012717; // NatGrid scale factor on central meridian
  var lat0 = 49 * Math.PI / 180, lon0 = -2 * Math.PI / 180; // NatGrid true origin
  var N0 = -100000, E0 = 400000; // northing & easting of true origin, metres
  var e2 = 1 - (b * b) / (a * a); // eccentricity squared
  var n = (a - b) / (a + b), n2 = n * n, n3 = n * n * n;

  var lat = lat0, M = 0;
  do {
    lat = (N - N0 - M) / (a * F0) + lat;

    var Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0);
    var Mb = (3 * n + 3 * n * n + (21 / 8) * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    var Mc = ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    var Md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
    M = b * F0 * (Ma - Mb + Mc - Md); // meridional arc
  } while (N - N0 - M >= 0.00001); // ie until < 0.01mm

  var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
  var nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat); // transverse radius of curvature
  var rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5); // meridional radius of curvature
  var eta2 = nu / rho - 1;

  var tanLat = Math.tan(lat);
  var tan2lat = tanLat * tanLat, tan4lat = tan2lat * tan2lat, tan6lat = tan4lat * tan2lat;
  var secLat = 1 / cosLat;
  var nu3 = nu * nu * nu, nu5 = nu3 * nu * nu, nu7 = nu5 * nu * nu;
  var VII = tanLat / (2 * rho * nu);
  var VIII = tanLat / (24 * rho * nu3) * (5 + 3 * tan2lat + eta2 - 9 * tan2lat * eta2);
  var IX = tanLat / (720 * rho * nu5) * (61 + 90 * tan2lat + 45 * tan4lat);
  var X = secLat / nu;
  var XI = secLat / (6 * nu3) * (nu / rho + 2 * tan2lat);
  var XII = secLat / (120 * nu5) * (5 + 28 * tan2lat + 24 * tan4lat);
  var XIIA = secLat / (5040 * nu7) * (61 + 662 * tan2lat + 1320 * tan4lat + 720 * tan6lat);

  var dE = (E - E0), dE2 = dE * dE, dE3 = dE2 * dE, dE4 = dE2 * dE2, dE5 = dE3 * dE2, dE6 = dE4 * dE2, dE7 = dE5 * dE2;
  lat = lat - VII * dE2 + VIII * dE4 - IX * dE6;
  var lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7;

  return {

    longitude: toDeg(lon),
    latitude: toDeg(lat)

  };
}

module.exports = OSGridToLatLong;
