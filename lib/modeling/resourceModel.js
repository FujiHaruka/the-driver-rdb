/**
 * Define resource model
 * @function resourceModel
 */

'use strict'

const clayId = require('clay-id')
const serializer = require('../helpers/serializer')
const { STRING } = require('sequelize')
const parseAttributeName = require('../parsing/parseAttributeName')
const { typeOf, withType } = require('clay-serial')
const extraModel = require('./extraModel')

/** @lends resourceModel */
function resourceModel (sequelize, resourceName) {
  const attributesMetaKey = `resource/${resourceName}/attributes`

  const baseRawAttributes = {
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
  ExtraModel.belongsTo(Model, {
    foreignKey: 'resourceId',
    targetKey: 'id',
  })

  const methods = {
    async ofCID (cid) {
      return await this.findOne({ where: { cid } })
    },
    async inbound (attributes) {
      const { knownAttributes } = this
      const result = {}
      for (const [k, v]of Object.entries(attributes)) {
        const { type } = knownAttributes[k] || {}
        const name = parseAttributeName(k)
        result[name] = serializer.serialize(v, type)
      }
      return result
    },
    async outbound (entity) {
      const { knownAttributes } = this
      const result = {}
      for (const [k, v]of Object.entries(entity.dataValues)) {
        if (k === 'id') {
          continue
        }
        if (k === 'cid') {
          result.id = v
          continue
        }
        const name = parseAttributeName.restore(k)
        const { type } = knownAttributes[k] || {}
        if (type) {
          result[name] = serializer.deserialize(v, type)
        } else {
          result[name] = v
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

    async prepare (options = {}) {
      await this.syncIfNeeded()
      const {
        attributes = {},
        meta,
      } = options
      const knownAttributes = this.knownAttributes = {
        ...(this.knownAttributes || {}),
        ...(await meta.get(attributesMetaKey) || {})
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
              type: STRING,
            }
            knownAttributes[name] = {
              type: typeOf(value),
              name,
            }
          }
          await this.init(newRawAttributes, { ...modelOptions, sequelize })
          await this.sync({ alter: true })
          await meta.set(attributesMetaKey, knownAttributes)
        }
      }
      this.knownAttributes = knownAttributes
      return this
    },
    async syncIfNeeded () {
      if (!this._synced) {
        await this.sync()
        this._synced = true
      }
    },
  }

  Object.assign(Model, methods)

  return Model
}

module.exports = resourceModel
