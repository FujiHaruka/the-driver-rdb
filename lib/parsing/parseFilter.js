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
  if (filter.$or) {
    const { $or, ...rest } = filter
    const orArray = $or.map((or) => ({ ...rest, ...or }))
    return parseFilter(orArray, options)
  }
  if (filter.$and) {
    const { $and, ...rest } = filter
    const andArray = $and.map((and) => ({ ...and, ...rest }))
    return parseFilter(Object.assign({}, ...andArray), options)
  }
  const {
    attributes = {},
    modelName,
  } = options
  const parsed = {}
  for (const name of Object.keys(filter)) {
    const value = Array.isArray(filter[name]) ? { $or: filter[name] } : filter[name]
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
            const operativeValue = raw ? subValue : serializeFilterValue(subValue, type)
            {
              const warning = warningForOperatorValue(operator, operativeValue)
              warning && logger.warn(warning)
            }
            parsed[parseAttributeName(name)] = {
              ...(parsed[parseAttributeName(name)] || {}),
              [operator]: operativeValue,
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
          const { raw, type } = attributes[name]
          parsed[parseAttributeName(name)] = raw ? value : serializer.serialize(value, type)
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

const serializeFilterValue = (value, type) => {
  if (Array.isArray(value)) {
    return value.map((value) => serializeFilterValue(value, type))
  }
  return serializer.serialize(value, type)
}

const warningForOperatorValue = (operator, value) => {
  switch (operator) {
    case Op.like: {
      if (!/%/.test(value)) {
        return `\`$like\` needs \`%\` expression. ( Maybe "%${value}%", not "${value}" )`
      }
      break
    }
    default:
      break
  }
  return null
}

module.exports = parseFilter
