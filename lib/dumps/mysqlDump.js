/**
 * Create mysql dump
 * @function mysqlDump
 */
'use strict'

const path = require('path')
const moment = require('moment')
const amkdirp = require('amkdirp')
const {spawn} = require('child_process')

/** @lends mysqlDump */
async function mysqlDump (config, dirname) {
  const filename = path.join(dirname, moment(new Date()).format(DUMP_FILENAME_FORMAT) + '.sql')
  await amkdirp(dirname)
  const {
    username,
    host,
    port,
    password,
    database
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
  return {filename}
}

module.exports = mysqlDump
