'use strict'

const { DataTypes } = require('clay-constants')
const { refTo } = require('clay-resource-ref')
const { typeOf, withType } = require('clay-serial')
const utf8 = require('utf8')
const { inspect } = require('util')
const {
  BOOLEAN,
  DATE,
  ENTITY,
  ID,
  NULL,
  NUMBER,
  OBJECT,
  REF,
  STRING,
} = DataTypes

const padLeft = (value, digit, padding = '0') => new Array(digit - String(value).length + 1).join(padding || '0') + value
const MAX_NUMBER_DIGIT = 24

exports.serialize = (value, type = typeOf(value)) => {
  const isMultiple = type !== OBJECT && Array.isArray(value)
  if (isMultiple) {
    return value.map((value) => exports.serialize(value, type))
  }
  switch (type) {
    case REF: {
      return value.$ref
    }
    case ENTITY: {
      return refTo(value.$$as, value.id)
    }
    case DATE: {
      return padLeft(String(new Date(value).getTime()), MAX_NUMBER_DIGIT)
    }
    case NUMBER: {
      if (String(value).length > MAX_NUMBER_DIGIT) {
        throw new Error(`[ClayDriverSequelize] Too large number: ${value}`)
      }
      // TODO $gt/$ltのためにゼロ詰めした文字列にしているけど非効率なので他の手段を考える
      return padLeft(value, MAX_NUMBER_DIGIT)
    }
    case ID: {
      return String(value)
    }
    case OBJECT: {
      return utf8.encode(JSON.stringify(value))
    }
    case STRING: {
      return utf8.encode(String(value))
    }
    default: {
      return String(value)
    }
  }
}

exports.deserialize = (value, type) => {
  const isMultiple = type !== OBJECT && Array.isArray(value)
  if (isMultiple) {
    return value.map((value) => exports.serialize(value, type))
  }
  switch (type) {
    case ID: {
      return String(value)
    }
    case ENTITY:
    case REF: {
      return { $ref: value }
    }
    case DATE: {
      value = Number(value)
      return withType(value, type)
    }
    case NUMBER: {
      if (typeof value === 'string') {
        value = value.replace(/^0*/, '')
      }
      return Number(value)
    }
    case OBJECT: {
      try {
        try {
          return JSON.parse(utf8.decode(String(value)))
        } catch (e) {
          // TODO Fallback for not-encoded data
          return JSON.parse(String(value))
        }
      } catch (e) {
        throw new Error(`[ClayDriverSequelize] Failed to deserialize: ${inspect(value)} (type: ${type})`)
      }
    }
    case BOOLEAN:
    case NULL: {
      return withType(value, type)
    }
    case STRING: {
      try {
        return utf8.decode(String(value))
      } catch (e) {
        return String(value)
      }
    }
    default: {
      return withType(value, type)
    }
  }
}
