/**
 * Define resource model
 * @function resourceModel
 */
'use strict'

const asleep = require('asleep')
const { DataTypes } = require('clay-constants')
const clayId = require('clay-id')
const { typeOf, withType } = require('clay-serial')
const Sequelize = require('sequelize')
const { uniqueFilter } = require('the-array')
const extraModel = require('./extraModel')
const { MetaColumnNames } = require('../constants')
const convertAttributeTypes = require('../helpers/convertAttributeTypes')
const serializer = require('../helpers/serializer')
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
  const defaultKnownAttributes = Object.assign(
    {},
    ...attributeNames.map((name) => ({ [name]: { name } }))
  )

  const baseRawAttributes = Object.assign({
      [MetaColumnNames.$$at]: {
        comment: 'Updated date',
        type: Sequelize.DATE,
      },
      [MetaColumnNames.$$num]: {
        comment: 'Version number',
        defaultValue: 0,
        type: Sequelize.INTEGER,
      },
      // TODO Move to another table?
      __attributeTypes: {
        comment: 'Data types',
        defaultValue: () => convertAttributeTypes({}),
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
        const extra = await ExtraModel.findOne({ where: { name, resourceId } })
        if (extra) {
          await extra.update({ type, value })
        } else {
          await ExtraModel.create({
            name,
            resourceId,
            type,
            value,
          })
        }
      }
    },
    async cleanup ({ meta }) {
      await meta.set(attributeNamesMetaKey, [])
    },
    async destroyAll ({ meta }) {
      await this.withLock('drop', async () => {
        await this.Extra.destroy({ truncate: true })
        await this.destroy({ where: {} })
        await this.syncIfNeeded(meta)
      })
    },
    extraValuesFromExtras (extras) {
      const ___extraValues = {}
      for (const extra of extras) {
        const { name, type, value } = extra
        ___extraValues[name] = {
          type,
          value,
        }
      }
      return ___extraValues
    },
    async inbound (attributes, options = {}) {
      if (!attributes) {
        return attributes
      }
      const { ___extraValues = {} } = options
      const result = {
        ___extraValues: { ...___extraValues },
      }
      const __attributeTypes = {
        ...(options.__attributeTypes || {}),
        ...convertAttributeTypes.restore(attributes.__attributeTypes),
      }
      for (const [name, v]of Object.entries(attributes)) {
        if (/^__/.test(name)) {
          continue
        }
        const type = typeOf(v)
        const colName = parseAttributeName(name)
        const serialized = serializer.serialize(v, type)
        const needsExtra = serialized && serialized.length >= valueBaseLength
        if (needsExtra) {
          result.___extraValues[colName] = {
            type,
            value: serialized,
          }
          result[colName] = JSON.stringify({ $extra: true })
        } else {
          result[colName] = serialized
          delete result.___extraValues[colName]
        }
        if (!META_ATTR_NAME_PREFIX.test(name)) {
          __attributeTypes[name] = type
        }
      }
      result.__attributeTypes = convertAttributeTypes(__attributeTypes)
      return result
    },
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
      const __attributeTypes = convertAttributeTypes.restore(entity.dataValues.__attributeTypes)
      for (const [colName, v]of Object.entries(entity.dataValues)) {
        if (/^__/.test(colName)) {
          continue
        }
        if (colName === 'id') {
          result.id = v
          continue
        }
        const name = parseAttributeName.restore(colName)
        const type = __attributeTypes[name]
        if (type) {
          result[name] = serializer.deserialize(v, type)
        } else {
          if (v !== null) {
            result[name] = v
          }
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
      return result
    },
    async prepare (options = {}) {
      const Model = this
      const {
        attributes = {},
        meta,
      } = options
      await Model.syncIfNeeded(meta)
      await this.withLock('prepareLock', async () => {
        const knownAttributes = {
          ...defaultKnownAttributes,
          ...Model.knownAttributes,
        }
        {
          const unknownNames = Object.keys(attributes)
            .filter((name) => name !== 'id')
            .filter((name) => !knownAttributes[name])
          if (unknownNames.length > 0) {
            const registered = await Model.registerAttributes(unknownNames)
            Object.assign(knownAttributes, registered)
            await meta.set(attributeNamesMetaKey, [
                ...Object.keys(knownAttributes),
                ...Object.keys(Model.knownAttributes || {})
              ]
                .filter((name) => !META_ATTR_NAME_PREFIX.test(name))
                .filter(uniqueFilter())
            )
            await Model.syncIfNeeded(meta)
          }
        }
        Model.knownAttributes = Object.assign(Model.knownAttributes || {}, knownAttributes, {
          $$at: { raw: true, type: DataTypes.DATE },
        })
      })
      return Model
    },
    async registerAttributes (attributeNames, options = {}) {
      const { retry = 3, retryInterval = 100 } = options
      this._registerAttributesWorking = {}
      const registered = {}
      const Model = this
      const { rawAttributes } = Model
      const newRawAttributes = {
        ...baseRawAttributes,
        ...rawAttributes,
      }
      let needsToSync = false
      for (const name of attributeNames) {
        if (META_ATTR_NAME_PREFIX.test(name)) {
          continue
        }
        const rawName = parseAttributeName(name)
        newRawAttributes[rawName] = newRawAttributes[rawName] || rawAttributeFor(name)
        registered[name] = { name }
        const needsToAdd = !(rawName in await Model.describe())
        if (needsToAdd) {
          needsToSync = true
          if (!this._registerAttributesWorking[rawName]) {
            this._registerAttributesWorking[rawName] = true
            await sequelize.queryInterface.addColumn(Model.tableName, rawName, newRawAttributes[rawName])
            delete this._registerAttributesWorking[rawName]
          }
        } else {
        }
      }
      await Model.init(newRawAttributes, { ...modelOptions, sequelize })
      await Model.associateIfNeeded()
      await Model.sync({})
      await Model.associateIfNeeded()

      {
        const missings = attributeNames
          .filter((name) => !/^\$\$/.test(name))
          .filter((name) => !(parseAttributeName(name) in Model.rawAttributes))
        if (missings.length > 0) {
          if (retry > 0) {
            await asleep(retryInterval)
            return await Model.registerAttributes(attributeNames, {
              ...options,
              retry: retry - 1,
              retryInterval: parseInt(retryInterval * (1 + 2 * Math.random())),
            })
          } else {
            throw new Error(`[TheDriverRDB] Failed to sync new attributes`)
          }
        }
      }
      return registered
    },
    async restoreFromMeta (meta) {
      await this.withLock('restoreFromMetaLock', async () => {
        const restoredNames = await meta.get(attributeNamesMetaKey)
        if (restoredNames && restoredNames.length > 0) {
          const registered = await Model.registerAttributes(restoredNames)
          Model.knownAttributes = Object.assign(Model.knownAttributes || {}, registered)
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
          await Model.restoreFromMeta(meta)
          await asleep(0)// next tick
        })
      }
      Model._synced = true
      await Model.associateIfNeeded()
      return Model
    },
    async withLock (lockName, action) {
      this.locks = this.locks || {}
      await this.locks[lockName]
      const lock = (async () => {
        await action()
      })()
      this.locks[lockName] = lock
      await lock
    },
  }

  Object.assign(Model, methods)

  return Model
}

module.exports = resourceModel
