/**
 * Test for TheDriverRDB.
 * Runs with mocha.
 */
'use strict'

const TheDriverRDB = require('../lib/TheDriverRDB')
const { ok, strictEqual } = require('assert')

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
      const created = await db.create('User', { name: 123 })
      strictEqual(created.name, 123)

      {
        const one = await db.one('User', created.id)
        strictEqual(one.name, 123)
      }

      {
        const updated = await db.update('User', created.id, { hoge: 1 })
        strictEqual(updated.hoge, 1)
        strictEqual(updated.id, created.id)
      }
    }

    await db.close()
    ok(db.closed)
  })
})

/* global describe, before, after, it */
