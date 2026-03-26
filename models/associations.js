const SmallSerialRequest = require('./SmallSerialRequest');
const SalesRep           = require('./SalesRep');

SalesRep.hasMany(SmallSerialRequest, {
  foreignKey: 'kamId',
  as:         'requests',
});

SmallSerialRequest.belongsTo(SalesRep, {
  foreignKey: 'kamId',
  as:         'kam',
});

module.exports = { SmallSerialRequest, SalesRep };