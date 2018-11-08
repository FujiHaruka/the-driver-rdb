/**
 * Define resource model
 * @function resourceModel
 */
'use strict'

const clayId = require('clay-id')
const { typeOf, withType } = require('clay-serial')
const { STRING } = require('sequelize')
const extraModel = require('./extraModel')
const serializer = require('../helpers/serializer')
const parseAttributeName = require('../parsing/parseAttributeName')

/** @lends resourceModel */
function resourceModel (sequelize, resourceName, options = {}) {
  const { valueBaseLength = 512 } = options
  const attributesMetaKey = `resource/${resourceName}/attributes`

  const baseRawAttributes = {
    __attributeTypes: {
      comment: 'Data types',
      defaultValue: () => JSON.stringify({}),
      type: STRING(512),
    },
    cid: {
      allowNull: false,
      comment: 'Clay ID',
      defaultValue: () => String(clayId()),
      type: STRING,
      unique: true,
    },
  }
  const modelOptions = {
    createdAt: false,
    freezeTableName: true,
    updatedAt: false,
  }
  const Model = sequelize.models[resourceName] || sequelize.define(resourceName, baseRawAttributes, modelOptions)
  const ExtraModel = extraModel(sequelize, resourceName)
  Model.Extra = ExtraModel

  const methods = {
    async ofCID (cid) {
      const Model = this
      const found = await Model.findOne({
        include: {
          as: '__extras',
          distinct: true,
          model: Model.Extra,
        },
        where: { cid },
      })
      return found
    },
    async inbound (attributes, opt) {
      const result = {
        ___extraValues: {},
      }
      const __attributeTypes = JSON.parse(attributes.__attributeTypes || '{}')
      for (const [k, v]of Object.entries(attributes)) {
        if (/^__/.test(k)) {
          continue
        }
        const type = typeOf(v)
        const name = parseAttributeName(k)
        const serialized = serializer.serialize(v, type)
        const needsExtra = serialized && serialized.length >= valueBaseLength
        if (needsExtra) {
          result.___extraValues[name] = {
            type,
            value: serialized,
          }
          result[name] = JSON.stringify({ $extra: true })
        } else {
          result[name] = serialized
        }
        __attributeTypes[k] = type
      }
      result.__attributeTypes = JSON.stringify(__attributeTypes)
      return result
    },
    async outbound (entity, options = {}) {
      const { ___extraValues } = options
      const { knownAttributes } = this
      const result = {}
      const __attributeTypes = JSON.parse(entity.dataValues.__attributeTypes || '{}')
      for (const [k, v]of Object.entries(entity.dataValues)) {
        if (/^__/.test(k)) {
          continue
        }
        if (k === 'id') {
          continue
        }
        if (k === 'cid') {
          result.id = v
          continue
        }
        const name = parseAttributeName.restore(k)
        const type = __attributeTypes[k] || (knownAttributes[k] || {}).type
        if (type) {
          result[name] = serializer.deserialize(v, type)
        } else {
          result[name] = v
        }
      }
      for (const extra of entity.dataValues['__extras'] || []) {
        const { name, type, value } = extra
        result[name] = serializer.deserialize(value, type)
      }
      if (___extraValues) {
        for (const [name, { type, value }] of Object.entries(___extraValues)) {
          result[name] = serializer.deserialize(value, type)
        }
      }
      for (const k of Object.keys(knownAttributes)) {
        const name = parseAttributeName.restore(k)
        const has = name in result
        if (!has) {
          result[name] = null
        }
      }
      return result
    },
    async bindExtra (resourceId, ___extraValues = {}) {
      const Model = this
      const ExtraModel = Model.Extra
      const knownExtras = await ExtraModel.findAll({
        where: { resourceId },
      })
      for (const extra of knownExtras) {
        const exists = extra.name in ___extraValues
        if (!exists) {
          await extra.destroy()
          continue
        }
        const { type, value } = ___extraValues[extra.name]
        const needsUpdate = (extra.value !== value) || (extra.type !== type)
        if (needsUpdate) {
          await extra.update({ type, value })
        }
      }
      for (const [name, { type, value }] of Object.entries(___extraValues)) {
        const isKnown = name in knownExtras
        if (isKnown) {
          continue
        }
        await ExtraModel.create({
          name,
          resourceId,
          type,
          value,
        })
      }
    },
    async cleanup ({ meta }) {
      await meta.set(attributesMetaKey, {})
    },
    async prepare (options = {}) {
      const Model = this
      await Model.syncIfNeeded()
      const {
        attributes = {},
        meta,
      } = options
      const knownAttributes = Model.knownAttributes = {
        ...(Model.knownAttributes || {}),
      }
      {
        const unknownNames = Object.keys(attributes)
          .filter((name) => !knownAttributes[name])
        if (unknownNames.length > 0) {
          const newRawAttributes = { ...baseRawAttributes }
          for (const name of unknownNames) {
            const rawName = parseAttributeName(name)
            const value = attributes[name]
            newRawAttributes[rawName] = newRawAttributes[rawName] || {
              comment: `Value for ${name} attribute`,
              type: STRING(valueBaseLength),
            }
            knownAttributes[name] = {
              name,
              type: typeOf(value),
            }
          }
          await Model.init(newRawAttributes, { ...modelOptions, sequelize })
          await Model.sync({ alter: true })
          await Model.associateIfNeeded()
          await meta.set(attributesMetaKey, knownAttributes)
        }
      }
      Model.knownAttributes = knownAttributes
      return Model
    },
    async syncIfNeeded () {
      const Model = this
      if (!Model._synced) {
        await Model.sync({ alter: true })
        await Model.Extra.sync({ alter: true })
        Model._synced = true
      }
      await Model.associateIfNeeded()
      return Model
    },
    async associateIfNeeded () {
      const Model = this
      if (!Model.associations['__extras']) {
        Model.hasMany(Model.Extra, {
          as: '__extras',
          foreignKey: {
            allowNull: false,
            name: 'resourceId',
          },
        })
      }
    }
  }

  Object.assign(Model, methods)

  return Model
}

module.exports = resourceModel
