/**
 * @function parseSort
 */
'use strict'

const parseAttributeName = require('./parseAttributeName')
const SORT_DEST_PREFIX = /^-/

/** @lends parseSort */
function parseSort (sort, options = {}) {
  const { attributes } = options
  return [].concat(sort)
    .filter(Boolean)
    .reduce((names, name) => names.concat(name.split(',')), [])
    .filter(Boolean)
    .map((name) => {
      const isDesc = SORT_DEST_PREFIX.test(name)
      const normalizeName = parseAttributeName(name.replace(SORT_DEST_PREFIX, ''), {
        attributes,
      })
      if (!normalizeName) {
        return null
      }
      return [normalizeName, isDesc ? 'DESC' : 'ASC']
    })
    .filter(Boolean)
}

module.exports = parseSort
