/**
 * @function convertAttributeTypes
 */
'use strict'

const { DataTypes } = require('clay-constants')

const inbounds = {
  [DataTypes.STRING]: 'STR',
  [DataTypes.BOOLEAN]: 'BOOL',
  [DataTypes.NUMBER]: 'NUM',
  [DataTypes.REF]: 'REF',
  [DataTypes.ENTITY]: 'ENT',
  [DataTypes.DATE]: 'DATE',
  [DataTypes.OBJECT]: 'OBJ',
  [DataTypes.ID]: 'ID',
  [DataTypes.NULL]: 'NUL',
}

const outbounds = Object.assign({},
  ...Object.entries(inbounds).map(([k, v]) => ({ [v]: k, }))
)

/** @lends convertAttributeTypes */
function convertAttributeTypes (__attributeTypes) {
  const converting = Object.entries(__attributeTypes || {}).reduce((reduced, [k, v]) => ({
    ...reduced,
    [k]: (v in inbounds) ? inbounds[v] : v,
  }), {})
  const converted = JSON.stringify(converting)
  return converted
}

convertAttributeTypes.restore = (__attributeTypes) => {
  const parsed = JSON.parse(__attributeTypes || '{}')
  const converted = Object.entries(parsed).reduce((reduced, [k, v]) => ({
    ...reduced,
    [k]: (v in outbounds) ? outbounds[v] : v,
  }), {})
  return converted
}

module.exports = convertAttributeTypes
