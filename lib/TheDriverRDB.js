/**
 * @class TheDriverRDB
 */
'use strict'

const m = require('./mixins')
const { Driver } = require('clay-driver-base')
const { isProduction } = require('the-check')
const clayEntity = require('clay-entity')
const {
  parseOutboundAttributes
} = require('./parsing')
const {
  metaModel,
  resourceModel,
} = require('./modeling')

const TheDriverRDBBase = [
  m.sequelizeMix,
].reduce((Driver, mix) => mix(Driver), Driver)

const asEntity = (values) => {
  if (!values) {
    return null
  }
  const entity = clayEntity(parseOutboundAttributes({ ...values.dataValues }))
  entity.id = entity.cid
  delete entity.cid
  return entity
}

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
    const { sequelize } = this
    const TheMeta = metaModel(sequelize)
    await TheMeta.prepare()
    this.meta = TheMeta
  }

  async untilReady () {
    await this.assertOpen()
    await this._preparing
  }

  async resourceModelFor (resourceName, { attributes } = {}) {
    const { meta, sequelize } = this
    const Model = resourceModel(sequelize, resourceName)
    return await Model.prepare({ attributes, meta })
  }

  async one (resourceName, id) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, {})
    const cid = String(id)
    const found = await Model.ofCID(cid)
    return asEntity(found)
  }

  async create (resourceName, attributes) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const created = await Model.create({ ...attributes })
    return asEntity(created)
  }

  async update (resourceName, id, attributes) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const cid = String(id)
    const model = await Model.ofCID(cid)
    if (!model) {
      throw new Error(`[TheDriverRDB] Data not found for id: ${id}`)
    }
    await model.update(attributes)
    return asEntity(model)
  }

  async destroy (resourceName, id) {
    await this.untilReady()
  }

  async drop (resourceName) {
    await this.untilReady()
  }

  async resources () {
    this.assertOpen()
  }

  assertOpen () {
    if (this.closed) {
      if (!isProduction()) {
        console.trace(`[SequelizeDriver] DB access after closed`)
      }
      throw new Error(`[SequelizeDriver] DB Already closed`)
    }
  }

  get sequelize () {
    return this._sequelize
  }

  async close () {
    await this._preparing
    const { sequelize } = this
    this.closed = true
    await sequelize.close()
  }
}

module.exports = TheDriverRDB
