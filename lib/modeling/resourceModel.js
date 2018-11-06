/**
 * Define resource model
 * @function resourceModel
 */
'use strict'

const clayId = require('clay-id')

/** @lends resourceModel */
function resourceModel (sequelize, resourceName) {
  const attributesMetaKey = `resource/${resourceName}/attributes`

  const baseAttributes = {
    cid: {
      allowNull: false,
      comment: 'Clay ID',
      defaultValue: () => String(clayId()),
      type: 'STRING',
      unique: true,
    },
  }
  const modelOptions = {
    createdAt: false,
    freezeTableName: true,
    updatedAt: false,
  }
  const Model = sequelize.models[resourceName] || sequelize.define(resourceName, baseAttributes, modelOptions)

  const methods = {
    async ofCID (cid) {
      return await this.findOne({where: {cid}})
    },
    async inbound () {
    },
    async outbound () {
    },
    async prepare (options = {}) {
      await this.syncIfNeeded()
      const {
        attributes = {},
        meta,
      } = options
      const knownAttributes = await meta.get(attributesMetaKey) || {}
      {
        const unknownNames = Object.keys(attributes)
          .filter((name) => !knownAttributes[name])
        if (unknownNames.length > 0) {
          const newAttributes = Object.assign({
              ...baseAttributes,
            },
            ...unknownNames.map((name) => ({
              [name]: {
                comment: `${name} value`,
                type: 'STRING',
              },
            }))
          )
          await this.init(newAttributes, {...modelOptions, sequelize})
          await this.sync({
            alter: true,
          })
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
