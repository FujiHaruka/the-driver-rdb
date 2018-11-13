/**
 * @function parseAttributeName
 * @param {string}
 * @returns {string}
 */
'use strict'

const { MetaColumnNames, MetaColumnNamesReversed } = require('../constants')

/** @lends parseAttributeName */
function parseAttributeName (name, options = {}) {
  if (name in MetaColumnNames) {
    return MetaColumnNames[name]
  }
  return name.replace(/\$/g, '\uFF04').replace(/\./g, '\uFF0E')
}

parseAttributeName.restore = (name) => {
  if (name in MetaColumnNamesReversed) {
    return MetaColumnNamesReversed[name]
  }
  return name.replace(/\uFF04/g, '$').replace(/\uFF0E/g, '.')
}

Object.assign(parseAttributeName, {})

module.exports = parseAttributeName
