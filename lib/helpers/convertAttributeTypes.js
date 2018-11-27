/**
 * @function convertAttributeTypes
 */
'use strict'

const { DataTypes } = require('clay-constants')
const querystring = require('querystring')
const inbounds = {
  [DataTypes.BOOLEAN]: 'BOOL',
  [DataTypes.DATE]: 'DATE',
  [DataTypes.ENTITY]: 'ENT',
  [DataTypes.ID]: 'ID',
  [DataTypes.NULL]: 'NUL',
  [DataTypes.NUMBER]: 'NUM',
  [DataTypes.OBJECT]: 'OBJ',
  [DataTypes.REF]: 'REF',
  [DataTypes.STRING]: 'STR',
}

const outbounds = Object.assign({},
  ...Object.entries(inbounds).map(([k, v]) => ({ [v]: k }))
)

/** @lends convertAttributeTypes */
function convertAttributeTypes (__attributeTypes) {
  __attributeTypes = __attributeTypes || {}
  const converting = Object.entries(__attributeTypes).reduce((reduced, [k, v]) => ({
    ...reduced,
    [k]: (v in inbounds) ? inbounds[v] : v,
  }), {})
  const converted = querystring.stringify(converting)
  return converted
}

convertAttributeTypes.restore = (__attributeTypes) => {
  __attributeTypes = __attributeTypes || '{}'
  // TODO Remove old JSON format
  const isJSON = /^{/.test(__attributeTypes)
  const parsed = isJSON ? JSON.parse(__attributeTypes) : querystring.parse(__attributeTypes)
  const converted = Object.entries(parsed).reduce((reduced, [k, v]) => ({
    ...reduced,
    [k]: (v in outbounds) ? outbounds[v] : v,
  }), {})
  return converted
}

module.exports = convertAttributeTypes
