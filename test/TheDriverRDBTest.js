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
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/hoge.db`
    })
    ok(!driver.closed)

    {
      const created = await driver.create('User', { name: 123 })
      equal(created.name, 123)

      {
        const one = await driver.one('User', created.id)
        equal(one.name, 123)
      }

      {
        const updated = await driver.update('User', created.id, { hoge: 1 })
        equal(updated.hoge, 1)
        equal(updated.id, created.id)
      }

      {
        const destroyed = await driver.destroy('User', created.id)
        equal(destroyed, 1)
      }

      {
        const listed = await driver.list('User')
        equal(listed.meta.total, 0)
      }

      {
        await driver.drop('User')
      }
    }

    await driver.close()
    ok(driver.closed)
  })

  it('Lists', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/list-test.db`
    })
    await driver.drop('Box')
    const created01 = await driver.create('Box', { name: 'b01' })
    const created02 = await driver.create('Box', { name: 'b02' })
    equal(
      (await driver.list('Box', { filter: { name: 'b02' } })).meta.total,
      1
    )
    equal(
      (await driver.list('Box', { filter: { name: 'xxxx' } })).meta.total,
      0
    )

    equal(
      (await driver.list('Box', { filter: { __unknown__: 'xxxx' } })).meta.total,
      0
    )

    equal(
      (await driver.list('Box', { sort: 'name' })).entities[0].id,
      created01.id,
    )
    equal(
      (await driver.list('Box', { sort: '-name' })).entities[0].id,
      created02.id
    )
  })

  it('List by ref', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/list-ref-test.db`
    })
    await driver.drop('Box')
    await driver.drop('BoxGroup')

    const boxGroup01 = await driver.create('BoxGroup', { name: 'bg01' })
    const boxGroup02 = await driver.create('BoxGroup', { name: 'bg02' })

    const box01 = await driver.create('Box', { group: boxGroup01 })
    const box02 = await driver.create('Box', { group: boxGroup02 })

  })
})

/* global describe, before, after, it */
