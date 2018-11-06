/**
 * @function metaModel
 */
'use strict'

/** @lends metaModel */
function metaModel (sequelize) {
  const TheMeta = sequelize.define('TheMeta', {
    key: {
      allowNull: false,
      type: 'STRING',
      unique: true,
    },
    value: {
      type: 'STRING',
    },
  }, {
    freezeTableName: true,
  })

  Object.assign(TheMeta, {
    async get (key) {
      const data = await this.findOne({ where: { key } })
      return data ? JSON.parse(data.value) : null
    },
    async set (key, value) {
      const [found] = await this.findOrCreate({ where: { key } })
      await found.update({ value: JSON.stringifYvalue })
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
