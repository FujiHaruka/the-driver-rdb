/**
 * Parse filter into where
 * @function parseFilter
 * @param {Object}
 * @return {Object}
 */
'use strict'

const { clone } = require('asobj')
const { DataTypes } = require('clay-constants')
const { typeOf } = require('clay-serial')
const { Op } = require('sequelize')
const { logger, serializer } = require('../helpers')

const INVALID_FILTER_CONDITION_ID = '____theInvalidFilterConditionID'

/** @lends parseFilter */
function parseFilter (filter, options = {}) {
  if (!filter) {
    return filter
  }
  if (Array.isArray(filter)) {
    return { [Op.or]: filter.map((filter) => parseFilter(filter, options)) }
  }
  const {
    attributes = {},
    modelName,
  } = options
  const parsed = {}
  for (const name of Object.keys(filter)) {
    const value = Array.isArray(filter[name]) ? { [Op.or]: filter[name] } : filter[name]
    const type = typeOf(value)
    switch (type) {
      default: {
        if (name in attributes) {
          parsed[name] = value
        } else {
          const filterableAttributes = Object.keys(attributes)
            .filter((name) => name !== 'id' && !/^_/.test(name))
          if (filterableAttributes.length > 0) {
            logger.warn(`Unknown filter "${name}" for ${modelName}`)
          }
          parsed.id = INVALID_FILTER_CONDITION_ID
        }
        break
      }
    }
  }
  return parsed
}

module.exports = parseFilter
