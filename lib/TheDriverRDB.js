/**
 * @class TheDriverRDB
 */
'use strict'

const amkdirp = require('amkdirp')
const clayCollection = require('clay-collection')
const { Driver } = require('clay-driver-base')
const { pageToOffsetLimit } = require('clay-list-pager')
const clayResourceName = require('clay-resource-name')
const path = require('path')
const { isProduction } = require('the-check')
const { MetaColumnNames } = require('./constants')
const convertAttributeTypes = require('./helpers/convertAttributeTypes')
const m = require('./mixins')
const {
  metaModel,
  resourceModel,
} = require('./modeling')
const {
  parseFilter,
  parseSort,
} = require('./parsing')
const resourceNamesMetaKey = `resource/resourceNames`

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
    this._sequelizeArgs = [database, username, password, {
      dialect,
      logging,
      storage,
      ...otherOptions,
    }]
  }

  get sequelize () {
    if (!this._sequelize) {
      this._sequelize = this.createSequelize(...this._sequelizeArgs)
    }
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
    await this.prepareIfNeeded()
    const { sequelize } = this
    this.closed = true
    await sequelize.close()
  }

  async create (resourceName, attributes = {}) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const { ___extraValues, ...saving } = await Model.inbound({ ...attributes })
    const created = await Model.create({ [MetaColumnNames.$$at]: new Date(), ...saving })
    await Model.bindExtra(created.id, ___extraValues)
    return await Model.outbound(created, { ___extraValues })
  }

  async destroy (resourceName, id) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName)
    const model = await Model.oneFor(id)
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
    await Model.destroyAll({ meta })
    await Model.cleanup({ meta })
  }

  async dump (dirname, options = {}) {
    const [
      database, username, password,
      { dialect, host, port }
    ] = this._sequelizeArgs
    switch (dialect) {
      case 'mysql':
        return await require('./dumps/mysqlDump')({
          database, host, password, port, username,
        }, dirname)
      default:
        throw new Error(`[TheDriverRDB] Dump not implemented for ${dialect}`)
    }
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
    const found = await Model.oneFor(id)
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
    const meta = this.meta = TheMeta
    {
      const resourceNames = await meta.get(resourceNamesMetaKey) || []
      for (const resourceName of resourceNames) {
        await this.resourceModelFor(resourceName)
      }
    }
  }

  async prepareIfNeeded () {
    await this._preparing
    if (this._prepared) {
      return
    }
    try {
      this._preparing = this.prepare()
      await this._preparing
      this._prepared = true
    } catch (e) {
      console.error(`[TheDriverRDB] Prepare failed`, e)
      process.exit(1)
    } finally {
    }
  }

  async resourceModelFor (resourceName, { attributes = {} } = {}) {
    const { meta, sequelize } = this
    const attributeNamesMetaKey = `resource/${resourceName}/attributeNames`
    const attributeNames = await meta.get(attributeNamesMetaKey) || []
    const Model = resourceModel(sequelize, resourceName, {
      attributeNames,
      attributeNamesMetaKey,
    })
    await Model.prepare({ attributes, meta })
    const resourceNames = await meta.get(resourceNamesMetaKey) || []
    if (!resourceNames.includes(resourceName)) {
      await meta.set(resourceNamesMetaKey, [...resourceNames, resourceName].sort())
    }
    return Model
  }

  async resources () {
    this.assertOpen()

    const resourceNames = await this.meta.get(resourceNamesMetaKey)
    return resourceNames
      .map((resourceName) => {
        const { domain, name } = clayResourceName(resourceName)
        return { domain, name }
      })
  }

  /**
   * Wait until ready
   * @returns {Promise<void>}
   */
  async untilReady () {
    await this.assertOpen()
    await this.prepareIfNeeded()
  }

  async update (resourceName, id, attributes) {
    await this.untilReady()
    const Model = await this.resourceModelFor(resourceName, { attributes })
    const model = await Model.oneFor(id)
    if (!model) {
      throw new Error(`[TheDriverRDB] Data not found for id: ${id}`)
    }

    const { ___extraValues, ...saving } = await Model.inbound({ ...attributes }, {
      ___extraValues: Model.extraValuesFromExtras(model['__extras']),
      __attributeTypes: convertAttributeTypes.restore(model.dataValues.__attributeTypes),
    })
    await Model.bindExtra(model.id, ___extraValues)
    await model.update({ [MetaColumnNames.$$at]: new Date(), ...saving })
    return await this.one(resourceName, id)
  }
}

module.exports = TheDriverRDB
