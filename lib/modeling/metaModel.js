/**
 * @function metaModel
 */
'use strict'

const { typeOf, withType } = require('clay-serial')
const { STRING } = require('sequelize')
const serializer = require('../helpers/serializer')

/** @lends metaModel */
function metaModel (sequelize) {
  const TheMeta = sequelize.define('TheMeta', {
    key: {
      allowNull: false,
      type: STRING,
      unique: true,
    },
    type: {
      comment: 'Type of value',
      type: STRING(64),
    },
    value: {
      comment: 'Value',
      type: STRING(1024),
    },
  }, {
    freezeTableName: true,
  })

  Object.assign(TheMeta, {
    async get (key) {
      const data = await this.findOne({ where: { key } })
      if (!data) {
        return null
      }
      const { type, value } = data
      return type ? serializer.deserialize(value, type) : value
    },
    async set (key, value) {
      const [found] = await this.findOrCreate({ where: { key } })
      const type = typeOf(value)
      if (found.type && found.type !== type) {
        throw new Error(`Invalid type: (expects: "${found.type}", detected: ${type}`)
      }
      await found.update({ type, value: serializer.serialize(value, type) })
    },
    async ensure (key, value) {
      const current = await this.get(key)
      const wrong = current !== null && current !== value
      if (wrong) {
        throw new Error(`[TheDriverRDB] Expects ${value} on ${key}, but ${current}`)
      }
      await this.set(key, value)
    },
    async prepare () {
      await this.sync()
      await this.ensure('driver', 'TheDriverRDB')
    },
  })

  return TheMeta
}

module.exports = metaModel
