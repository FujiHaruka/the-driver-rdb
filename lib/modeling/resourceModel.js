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
  const {
    attributeNames = [],
    attributeNamesMetaKey,
    valueBaseLength = 512,
  } = options
  const rawAttributeFor = (name) => ({
    comment: `Value for ${name} attribute`,
    type: STRING(valueBaseLength),
  })

  const baseRawAttributes = Object.assign({
      __attributeTypes: {
        comment: 'Data types',
        defaultValue: () => JSON.stringify({}),
        type: STRING(512),
      },
      id: {
        allowNull: false,
        comment: 'Clay ID',
        defaultValue: () => String(clayId()),
        primaryKey: true,
        type: STRING,
        unique: true,
      },
    },
    ...attributeNames.map((name) => ({
      [parseAttributeName(name)]: rawAttributeFor(name),
    })),
  )
  const modelOptions = {
    createdAt: false,
    freezeTableName: true,
    updatedAt: false,
  }
  const Model = sequelize.models[resourceName] || sequelize.define(resourceName, baseRawAttributes, modelOptions)
  const ExtraModel = extraModel(sequelize, resourceName)
  Model.Extra = ExtraModel

  const methods = {
    async oneFor (id) {
      const Model = this
      const found = await Model.findByPk(id, {
        include: {
          as: '__extras',
          distinct: true,
          model: Model.Extra,
        },
      })
      return found
    },
    async inbound (attributes, opt) {
      if (!attributes) {
        return attributes
      }
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
      if (!entity) {
        return entity
      }
      const { ___extraValues } = options
      const { knownAttributes } = this
      const result = {}
      const __attributeTypes = JSON.parse(entity.dataValues.__attributeTypes || '{}')
      for (const [k, v]of Object.entries(entity.dataValues)) {
        if (/^__/.test(k)) {
          continue
        }
        if (k === 'id') {
          result.id = v
          continue
        }
        const name = parseAttributeName.restore(k)
        const type = __attributeTypes[k]
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
      await meta.set(attributeNamesMetaKey, [])
    },
    async registerAttributes (attributeNames) {
      const registered = {}
      const Model = this
      const newRawAttributes = { ...baseRawAttributes }
      const desc = await Model.describe()
      for (const name of attributeNames) {
        const rawName = parseAttributeName(name)
        newRawAttributes[rawName] = newRawAttributes[rawName] || rawAttributeFor(name)
        registered[name] = { name }
        const needsToAdd = !(rawName in desc)
        if (needsToAdd) {
          await sequelize.queryInterface.addColumn(Model.tableName, rawName, newRawAttributes[rawName])
        }
      }

      await Model.init(newRawAttributes, { ...modelOptions, sequelize })
      await Model.sync({})
      await Model.associateIfNeeded()
      return registered
    },
    async prepare (options = {}) {
      const Model = this
      const {
        attributes = {},
        meta,
      } = options
      await Model.syncIfNeeded(meta)
      const knownAttributes = {}

      {
        const unknownNames = Object.keys(attributes)
          .filter((name) => name !== 'id')
          .filter((name) => !knownAttributes[name])
        if (unknownNames.length > 0) {
          const registered = await Model.registerAttributes(unknownNames)
          Object.assign(knownAttributes, registered)
          await meta.set(attributeNamesMetaKey, Object.keys(knownAttributes))
        }
      }
      Model.knownAttributes = Object.assign(Model.knownAttributes || {}, knownAttributes)
      return Model
    },
    async restoreFromMeta (meta) {
      const restoredNames = await meta.get(attributeNamesMetaKey)
      if (restoredNames && restoredNames.length > 0) {
        const registered = await Model.registerAttributes(restoredNames)
        Model.knownAttributes = Object.assign(Model.knownAttributes || {}, registered)
      }
    },
    async syncIfNeeded (meta) {
      const Model = this
      if (!Model._synced) {
        await Model.sync({})
        await Model.Extra.sync({})
        await this.restoreFromMeta(meta)
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
    },
  }

  Object.assign(Model, methods)

  return Model
}

module.exports = resourceModel
