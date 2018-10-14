/**
 * Test for TheDriverRDB.
 * Runs with mocha.
 */
'use strict'

const TheDriverRDB = require('../lib/TheDriverRDB')
const {ok, equal} = require('assert')

describe('the-driver-r-d-b', () => {
  before(() => {
  })

  after(() => {
  })

  it('Do test', async () => {
    const db = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/hoge.db`
    })
    ok(!db.closed)

    {
      const created = db.create('User', {foo: 123})
    }

    await db.close()
    ok(db.closed)
  })
})

/* global describe, before, after, it */
