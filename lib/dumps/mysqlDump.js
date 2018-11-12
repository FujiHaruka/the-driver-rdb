/**
 * Create mysql dump
 * @function mysqlDump
 */
'use strict'

const amkdirp = require('amkdirp')
const { spawn } = require('child_process')
const { DateFormats } = require('clay-constants')
const moment = require('moment')
const fs = require('fs')
const path = require('path')

const { DUMP_FILENAME_FORMAT } = DateFormats

/** @lends mysqlDump */
async function mysqlDump (config, dirname) {
  const filename = path.join(dirname, moment(new Date()).format(DUMP_FILENAME_FORMAT) + '.sql')
  await amkdirp(dirname)
  const {
    database,
    host,
    password,
    port,
    username,
  } = config
  const w = fs.createWriteStream(filename)

  await new Promise((resolve, reject) => {
    const mysqldump = spawn('mysqldump', [
      '--user', username,
      '--host', host,
      '--port', port,
      '-p' + password,
      '--databases', database,
    ])
    mysqldump.stdout.pipe(w)
    mysqldump.on('close', resolve)
    mysqldump.stderr.on('error', reject)
  })
  return { filename }
}

module.exports = mysqlDump
