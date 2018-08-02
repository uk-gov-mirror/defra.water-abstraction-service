const { returnsDateToIso } = require('./lib/date-helpers');

const { formatAbstractionPoint } = require('../../lib/licence-transformer/nald-helpers');

const {
  getFormats,
  getFormatPurposes,
  getFormatPoints,
  // getLogs,
  getLines
} = require('./lib/nald-returns-queries.js');

const {
  convertNullStrings,
  mapFrequency,
  mapPeriod,
  getStartDate,
  mapUnit,
  mapUsability,
  calculateReturnsCycles
} = require('./lib/transform-returns-helpers.js');

const buildReturnsPacket = async (licenceNumber) => {
  const formats = await getFormats(licenceNumber);

  for (let format of formats) {
    const cycles = calculateReturnsCycles(format);

    format.cycles = [];

    for (let cycle of cycles) {
      const lines = await getLines(format.ID, format.FGAC_REGION_CODE, cycle.startDate, cycle.endDate);
      format.cycles.push({ cycle, lines });
    }

    format.purposes = await getFormatPurposes(format.ID, format.FGAC_REGION_CODE);
    format.points = await getFormatPoints(format.ID, format.FGAC_REGION_CODE);
    // format.logs = logs;
  }

  const returnsData = {
    returns: [],
    versions: [],
    lines: []
  };

  for (let format of formats) {
    // console.log('format!');
    // console.log(calculateReturnsCycles(format));

    for (let cycle of format.cycles) {
      const { startDate, endDate } = cycle.cycle;
      const logId = `${startDate}:${endDate}`;
      const returnId = `v1:${format.FGAC_REGION_CODE}:${licenceNumber}:${format.ID}:${logId}`;

      const returnRow = {
        return_id: returnId,
        regime: 'water',
        licence_type: 'abstraction',
        licence_ref: licenceNumber,
        start_date: startDate,
        end_date: endDate,
        returns_frequency: mapFrequency(format.ARTC_REC_FREQ_CODE),
        status: 'complete',
        source: 'NALD',
        metadata: JSON.stringify({
          version: 1,
          description: format.SITE_DESCR,
          purposes: format.purposes.map(purpose => ({
            primary: {
              code: purpose.APUR_APPR_CODE,
              description: purpose.primary_purpose
            },
            secondary: {
              code: purpose.APUR_APSE_CODE,
              description: purpose.secondary_purpose
            },
            tertiary: {
              code: purpose.APUR_APUS_CODE,
              description: purpose.tertiary_purpose
            }
          })),
          points: format.points.map(point => formatAbstractionPoint(convertNullStrings(point))),
          nald: {
            regionCode: parseInt(format.FGAC_REGION_CODE),
            formatId: parseInt(format.ID),
            // dateFrom: dateToIsoString(log.DATE_FROM),
            // dateTo: dateToIsoString(log.DATE_TO),
            // dateReceived: dateToIsoString(log.RECD_DATE),
            periodStartDay: format.ABS_PERIOD_ST_DAY,
            periodStartMonth: format.ABS_PERIOD_ST_MONTH,
            periodEndDay: format.ABS_PERIOD_END_DAY,
            periodEndMonth: format.ABS_PERIOD_END_MONTH
            // underQuery: log.UNDER_QUERY_FLAG === 'Y'
          }
        })
        // @TODO deal with received date
        // received_date: log.RECD_DATE === '' ? null : dateToIsoString(log.RECD_DATE)
      };

      const versionRow = {
        version_id: returnId,
        return_id: returnId,
        version_number: 1,
        user_id: 'water-abstraction-service',
        user_type: 'agency',
        metadata: '{}',
        nil_return: false
        // @TODO deal with nil returns,
        // nil_return: log.lines.length === 0
      };

      returnsData.returns.push(returnRow);
      returnsData.versions.push(versionRow);

      for (let line of cycle.lines) {
        const endDate = returnsDateToIso(line.RET_DATE);
        const lineRow = {
          line_id: `${returnId}:${line.RET_DATE}`,
          version_id: returnId,
          substance: 'water',
          quantity: line.RET_QTY === '' ? null : parseFloat(line.RET_QTY),
          unit: mapUnit(line.UNIT_RET_FLAG) || '?',
          start_date: getStartDate(line.ARFL_DATE_FROM, line.RET_DATE, format.ARTC_REC_FREQ_CODE),
          end_date: endDate,
          time_period: mapPeriod(format.ARTC_REC_FREQ_CODE),
          metadata: '{}',
          reading_type: mapUsability(line.RET_QTY_USABILITY)
        };

        returnsData.lines.push(lineRow);
      }
    }
  }

  return returnsData;
};

module.exports = {
  buildReturnsPacket
};
