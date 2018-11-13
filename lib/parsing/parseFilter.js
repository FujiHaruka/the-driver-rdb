/**
 * Parse filter into where
 * @function parseFilter
 * @param {Object}
 * @return {Object}
 */
'use strict'

const { clone } = require('asobj')
const { DataTypes: { ENTITY, OBJECT, REF, STRING } } = require('clay-constants')
const { typeOf } = require('clay-serial')
const { Op } = require('sequelize')
const parseAttributeName = require('./parseAttributeName')
const { MetaColumnNamesReversed } = require('../constants')
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
    const isKnown = name in attributes
    switch (type) {
      case OBJECT: {
        const subNames = Object.keys(value)
        for (const subName of subNames) {
          const subValue = value[subName]
          const isOperator = /^\$/.test(subName)
          if (isOperator) {
            const operator = Op[subName.replace(/^\$/, '')] || subName
            if (!isKnown) {
              logger.warn(`Unknown filter "${name}" for ${modelName}`)
              continue
            }
            const { raw, type } = attributes[name]
            parsed[parseAttributeName(name)] = {
              [operator]: raw ? subValue : serializer.serialize(subValue, type),
            }
          } else {
            logger.warn(`Passing nested filter is not supported: "${name}.${subName}"`)
            if (subName === 'id') {
              logger.warn('If you want to filter by entity, use ref string instead of id (eg. `filter:{user: {$ref: "User#01"}}`)')
            }
            parsed.id = INVALID_FILTER_CONDITION_ID
          }
        }
        break
      }
      default: {
        if (isKnown) {
          const { type } = attributes[name]
          parsed[parseAttributeName(name)] = serializer.serialize(value, type)
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
