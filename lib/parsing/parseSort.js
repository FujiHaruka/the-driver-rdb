/**
 * @function parseSort
 */
'use strict'

const parseAttributeName = require('./parseAttributeName')
const SORT_DEST_PREFIX = /^-/
const { logger } = require('../helpers')

/** @lends parseSort */
function parseSort (sort, options = {}) {
  const {
    modelName,
    attributes = {}
  } = options
  return [].concat(sort)
    .filter(Boolean)
    .reduce((names, name) => names.concat(name.split(',')), [])
    .filter(Boolean)
    .map((name) => {
      const isDesc = SORT_DEST_PREFIX.test(name)
      const normalizeName = parseAttributeName(name.replace(SORT_DEST_PREFIX, ''))
      if (!normalizeName) {
        return null
      }
      {
        const isKnown = normalizeName in attributes
        if (!isKnown) {
          logger.warn(`Unknown filter "${name}" for ${modelName}`)
          return null
        }
      }
      return [normalizeName, isDesc ? 'DESC' : 'ASC']
    })
    .filter(Boolean)
}

module.exports = parseSort
