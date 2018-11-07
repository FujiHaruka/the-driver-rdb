/**
 * @function parseAttributeName
 * @param {string}
 * @returns {string}
 */
'use strict'

/** @lends parseAttributeName */
function parseAttributeName (name, options = {}) {
  return name.replace(/\$/g, '\uFF04').replace(/\./g, '\uFF0E')
}

parseAttributeName.restore = (name) => {
  return name.replace(/\uFF04/g, '$').replace(/\uFF0E/g, '.')
}

Object.assign(parseAttributeName, {})

module.exports = parseAttributeName
