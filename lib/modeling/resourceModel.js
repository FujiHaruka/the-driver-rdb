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
      type: 'STRING',
      unique: true,
      allowNull: false,
      comment: 'Clay ID',
      defaultValue: () => String(clayId()),
    }
  }
  const modelOptions = {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
  }
  const Model = sequelize.models[resourceName] || sequelize.define(resourceName, baseAttributes, modelOptions)

  const methods = {
    async ofCID (cid) {
      return await this.findOne({ where: { cid } })
    },
    async prepare (options = {}) {
      await this.syncIfNeeded()
      const {
        attributes = {},
        meta,
      } = options

      {
        const unknownNames = Object.keys(attributes)
          .filter((name) => !Model.rawAttributes[name])
        if (unknownNames.length > 0) {
          const newAttributes = Object.assign({
              ...baseAttributes,
            },
            ...unknownNames.map((name) => ({
              [name]: {
                type: 'STRING',
                comment: `${name} value`,
              }
            }))
          )
          await this.init(newAttributes, { ...modelOptions, sequelize })
          await this.sync({
            alter: true,
          })
          return this
        }
      }
      return this
    },
    async syncIfNeeded () {
      if (!this._synced) {
        await this.sync()
        this._synced = true
      }
    }
  }

  Object.assign(Model, methods)

  return Model
}

module.exports = resourceModel
