/**
 * @class TheDriverRDB
 */
'use strict'

const m = require('./mixins')
const {Driver} = require('clay-driver-base')
const {metaModel} = require('./modeling')

const TheDriverRDBBase = [
  m.sequelizeMix,
].reduce((Driver, mix) => mix(Driver), Driver)

/** @lends TheDriverRDB */
class TheDriverRDB extends TheDriverRDBBase {
  constructor (config = {}) {
    super()
    const {
      database,
      username,
      password,
      storage = `var/db/${database}.db`,
      dialect = 'sqlite',
      logging = false,
    } = config
    this.closed = false
    this._sequelize = this.createSequelize(database, username, password, {
      dialect,
      storage,
      logging,
    })
    this._preparing = this.prepare()
      .catch((e) => {
        console.error(`[TheDriverRDB] Prepare failed`, e)
        process.exit(1)
      }).then(() => {
        this._preparing = null
      })
  }

  async prepare () {
    const {sequelize} = this
    const TheMeta = metaModel(sequelize)
    await TheMeta.prepare()
  }

  async create (resourceName, attributes) {
    const {sequelize} = this

  }

  get sequelize () {
    return this._sequelize
  }

  async close () {
    await this._preparing
    const {sequelize} = this
    this.closed = true
    await sequelize.close()
  }
}

module.exports = TheDriverRDB
