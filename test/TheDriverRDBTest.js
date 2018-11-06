/**
 * Test for TheDriverRDB.
 * Runs with mocha.
 */
'use strict'

const TheDriverRDB = require('../lib/TheDriverRDB')
const { ok, strictEqual: equal } = require('assert')

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
      equal(created.name, 123)

      {
        const one = await db.one('User', created.id)
        equal(one.name, 123)
      }

      {
        const updated = await db.update('User', created.id, { hoge: 1 })
        equal(updated.hoge, 1)
        equal(updated.id, created.id)
      }

      {
        const destroyed = await db.destroy('User', created.id)
        equal(destroyed, 1)
      }

      {
        const listed = await db.list('User')
        equal(listed.meta.total, 0)
      }

      {
        await db.drop('User')
      }
    }

    await db.close()
    ok(db.closed)
  })

  it('Lists', async () => {
    const db = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/list-test.db`
    })
    await db.create('Box', { name: 'b01' })
    await db.create('Box', { name: 'b02' })
    console.log(
      (await db.list('Box', { filter: { name: 'b02' } })).meta
    )
    await db.drop('Box')
  })
})

/* global describe, before, after, it */
