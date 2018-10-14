/**
 * Create a TheDriverRDB instance
 * @function create
 * @param {...*} args
 * @returns {TheDriverRDB}
 */
'use strict'

const TheDriverRDB = require('./TheDriverRDB')

/** @lends create */
function create (...args) {
  return new TheDriverRDB(...args)
}

module.exports = create
