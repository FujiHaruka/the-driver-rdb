/**
 * Default exports
 * @module default
 */
'use strict'

const create = require('./create')
const TheDriverRDB = require('./TheDriverRDB')

const lib = create.bind(create)

module.exports = Object.assign(lib, {
  TheDriverRDB,
})
