/**
 * Define resource model
 * @function resourceModel
 */
'use strict'

const { DataTypes } = require('clay-constants')
const clayId = require('clay-id')
const { typeOf, withType } = require('clay-serial')
const Sequelize = require('sequelize')
const extraModel = require('./extraModel')
const { MetaColumnNames } = require('../constants')
const serializer = require('../helpers/serializer')
const { uniqueFilter } = require('the-array')
const parseAttributeName = require('../parsing/parseAttributeName')
const META_ATTR_NAME_PREFIX = /^\$\$/

/** @lends resourceModel */
function resourceModel (sequelize, resourceName, options = {}) {
  const {
    attributeNames = [],
    attributeNamesMetaKey,
    valueBaseLength = 512,
  } = options
  const rawAttributeFor = (name) => ({
    comment: `Value for ${name} attribute`,
    type: Sequelize.STRING(valueBaseLength),
  })

  const baseRawAttributes = Object.assign({
      [MetaColumnNames.$$at]: {
        comment: 'Updated date',
        type: Sequelize.DATE,
      },
      [MetaColumnNames.$$num]: {
        comment: 'Version number',
        type: Sequelize.INTEGER,
      },
      // TODO Move to another table?
      __attributeTypes: {
        comment: 'Data types',
        defaultValue: () => JSON.stringify({}),
        type: Sequelize.TEXT,
      },
      id: {
        allowNull: false,
        comment: 'Clay ID',
        defaultValue: () => String(clayId()),
        primaryKey: true,
        type: Sequelize.STRING,
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
    indexes: [
      // TODO Needs index?
    ],
    timestamps: true,
    updatedAt: false,
    version: MetaColumnNames.$$num,
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
    async inbound (attributes, options = {}) {
      if (!attributes) {
        return attributes
      }
      const result = {
        ___extraValues: {},
      }
      const __attributeTypes = {
        ...(options.__attributeTypes || {}),
        ...JSON.parse(attributes.__attributeTypes || '{}'),
      }
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
        if (!META_ATTR_NAME_PREFIX.test(k)) {
          __attributeTypes[k] = type
        }
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
      const result = {
        $$as: resourceName,
        $$at: entity[MetaColumnNames.$$at],
        $$num: entity[MetaColumnNames.$$num],
      }
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
    async registerAttributes (attributeNames, options = {}) {
      const { sync = false } = options
      const registered = {}
      const Model = this
      const newRawAttributes = { ...baseRawAttributes }
      let shouldSyncModel = sync
      const desc = await Model.describe()
      for (const name of attributeNames) {
        if (META_ATTR_NAME_PREFIX.test(name)) {
          continue
        }
        const rawName = parseAttributeName(name)
        newRawAttributes[rawName] = newRawAttributes[rawName] || rawAttributeFor(name)
        registered[name] = { name }
        const needsToAdd = !(rawName in desc)
        if (needsToAdd) {
          await sequelize.queryInterface.addColumn(Model.tableName, rawName, newRawAttributes[rawName])
          shouldSyncModel = true
        }
      }
      if (shouldSyncModel) {
        await Model.init(newRawAttributes, { ...modelOptions, sequelize })
        await Model.associateIfNeeded()
        await Model.sync({})
        await Model.associateIfNeeded()
      }
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
          await this.withLock('prepareLock', async () => {
            const registered = await Model.registerAttributes(unknownNames)
            Object.assign(knownAttributes, registered)
            await meta.set(attributeNamesMetaKey, [
              ...Object.keys(knownAttributes),
              ...Object.keys(Model.knownAttributes || {})
            ]
              .filter(uniqueFilter())
              .filter((name) => !META_ATTR_NAME_PREFIX.test(name)))
          })
        }
      }
      Model.knownAttributes = Object.assign(Model.knownAttributes || {}, knownAttributes, {
        $$at: { raw: true, type: DataTypes.DATE },
      })
      return Model
    },
    async restoreFromMeta (meta) {
      await this.withLock('restoreFromMetaLock', async () => {
        const restoredNames = await meta.get(attributeNamesMetaKey)
        if (restoredNames && restoredNames.length > 0) {
          const registered = await Model.registerAttributes(restoredNames, {
            sync: true,
          })
          Model.knownAttributes = Object.assign(Model.knownAttributes || {}, registered)
        }
      })
    },
    async withLock (lockName, action) {
      this.locks = this.locks || {}
      await this.locks[lockName]
      this.locks[lockName] = (async () => {
        try {
          await action()
        } finally {
          this.locks[lockName] = null
        }
      })()
      await this.locks[lockName]
    },
    async truncate ({ meta }) {
      await this.withLock('truncate', async () => {
        const maxRetry = 3
        for (let i = 0; i < maxRetry; i++) {
          try {
            await this.destroy({ truncate: true })
            await this.Extra.destroy({ truncate: true })
            await this.syncIfNeeded(meta)
          } catch (e) {
            continue
          }
          break
        }
      })
    },
    async syncIfNeeded (meta) {
      const Model = this
      if (!Model._synced) {
        await this.withLock('syncLock', async () => {
          await Model.sync({})
          await Model.associateIfNeeded()
          await Model.Extra.sync({})
          await Model.associateIfNeeded()
          await this.restoreFromMeta(meta)
        })
      }
      Model._synced = true
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
