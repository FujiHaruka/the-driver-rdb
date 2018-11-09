/**
 * @class TheDriverRDB
 */
'use strict'

const amkdirp = require('amkdirp')
const clayCollection = require('clay-collection')
const { Driver } = require('clay-driver-base')
const { pageToOffsetLimit } = require('clay-list-pager')
const path = require('path')
const { isProduction } = require('the-check')
const m = require('./mixins')
const {
  metaModel,
  resourceModel,
} = require('./modeling')
const {
  parseFilter,
  parseSort,
} = require('./parsing')

const TheDriverRDBBase = [
  m.sequelizeMix,
].reduce((Driver, mix) => mix(Driver), Driver)

/** @lends TheDriverRDB */
class TheDriverRDB extends TheDriverRDBBase {
  constructor (config = {}) {
    super()
    const {
      database,
      dialect = 'sqlite',
      logging = false,
      password,
      storage = `var/db/${database}.db`,
      username,
      ...otherOptions
    } = config
    this.closed = false
    this._sequelize = this.createSequelize(database, username, password, {
      dialect,
      logging,
      storage,
      ...otherOptions,
    })
    this._preparing = this.prepare()
      .catch((e) => {
        console.error(`[TheDriverRDB] Prepare failed`, e)
        process.exit(1)
      }).then(() => {
        this._preparing = null
      })
  }

  get sequelize () {
    return this._sequelize
  }

  assertOpen () {
    if (this.closed) {
      if (!isProduction()) {
        console.trace(`[SequelizeDriver] DB access after closed`)
      }
      throw new Error(`[SequelizeDriver] DB Already closed`)
    }
  }

  async close () {
    await this._preparing
    const { sequelize } = this
    this.closed = true
    await sequelize.close()
  }

  async create (resourceName, attributes = {}) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const { ___extraValues, ...saving } = await Model.inbound({ ...attributes })

    const created = await Model.create(saving)
    await Model.bindExtra(created.id, ___extraValues)
    return await Model.outbound(created, { ___extraValues })
  }

  async destroy (resourceName, id) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName)
    const cid = String(id)
    const model = await Model.ofCID(cid)
    if (!model) {
      return 0
    }
    await model.destroy({})
    return 1
  }

  async drop (resourceName) {
    await this.untilReady()
    const { meta } = this
    const Model = await this.resourceModelFor(resourceName)
    await Model.Extra.destroy({ truncate: true })
    await Model.destroy({ truncate: true })
    await Model.cleanup({ meta })
  }

  async list (resourceName, condition = {}) {
    await this.untilReady()
    const { filter = {}, page = {}, sort = [] } = condition
    const { limit, offset } = pageToOffsetLimit(page)
    const Model = await this.resourceModelFor(resourceName, {})
    const where = parseFilter(filter, {
      attributes: Model.knownAttributes,
      modelName: Model.name,
    })
    const order = parseSort(sort, {
      attributes: Model.knownAttributes,
      modelName: Model.name,
    })
    const { count, rows } = await Model.findAndCountAll({
      distinct: true,
      include: { as: '__extras', model: Model.Extra },
      limit,
      offset,
      order,
      where,
    })
    return clayCollection({
      entities: await Promise.all(
        rows.map(async (entity) => await Model.outbound(entity))
      ),
      meta: {
        length: rows.length,
        limit,
        offset,
        total: count,
      },
    })
  }

  async one (resourceName, id) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, {})
    const cid = String(id)
    const found = await Model.ofCID(cid)
    return await Model.outbound(found)
  }

  async prepare () {
    const { sequelize } = this
    const { dialect, storage } = sequelize.options || {}
    switch (dialect) {
      case 'sqlite':
        await amkdirp(path.dirname(storage))
        break
      default:
        break
    }
    const TheMeta = metaModel(sequelize)
    await TheMeta.prepare()
    this.meta = TheMeta
  }

  async resourceModelFor (resourceName, { attributes } = {}) {
    const { meta, sequelize } = this
    const attributeNamesMetaKey = `resource/${resourceName}/attributeNames`
    const attributeNames = await meta.get(attributeNamesMetaKey) || []
    const Model = resourceModel(sequelize, resourceName, {
      attributeNames,
      attributeNamesMetaKey,
    })
    return await Model.prepare({ attributes, meta })
  }

  async resources () {
    this.assertOpen()
    // TODO
    return {}
  }

  /**
   * Wait until ready
   * @returns {Promise<void>}
   */
  async untilReady () {
    await this.assertOpen()
    await this._preparing
  }

  async update (resourceName, id, attributes) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const cid = String(id)
    const model = await Model.ofCID(cid)
    if (!model) {
      throw new Error(`[TheDriverRDB] Data not found for id: ${id}`)
    }

    const { ___extraValues, ...saving } = await Model.inbound({ ...attributes })
    await Model.bindExtra(model.id, ___extraValues)
    await model.update(saving)
    return await this.one(resourceName, id)
  }
}

module.exports = TheDriverRDB
