/**
 * Test for TheDriverRDB.
 * Runs with mocha.
 */
'use strict'

const TheDriverRDB = require('../lib/TheDriverRDB')
const { ok, strictEqual: equal, deepStrictEqual: deepEqual } = require('assert')

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

    await driver.drop('User')

    {
      const created = await driver.create('User', { name: 123 })
      equal(created.name, 123)

      {
        const one = await driver.one('User', created.id)
        equal(one.name, 123)
      }

      {
        const listed = await driver.list('User', {})
        equal(listed.meta.total, 1)
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
        const listed = await driver.list('User', {})
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

    const group01 = await driver.create('BoxGroup', { name: 'bg01' })
    const group02 = await driver.create('BoxGroup', { name: 'bg02' })

    const box01 = await driver.create('Box', { group: { $ref: `Group#${group01.id}` } })
    const box02 = await driver.create('Box', { group: { $ref: `Group#${group02.id}` } })

    equal(box01.group.$ref, `Group#${group01.id}`)

    equal(
      (await driver.list('Box', {
        filter: { group: { $ref: `Group#${group01.id}` } }
      })).entities[0].id,
      box01.id,
    )

    equal(
      (await driver.list('Box', {
        filter: { group: { $ref: `Group#${group02.id}` } }
      })).entities[0].id,
      box02.id,
    )

  })

  it('Handling object and array', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/obj-array-test.db`
    })

    const created = await driver.create('Big', {
      name: 'd1',
      values: {
        s1: 'string01',
        s2: 'string02',
        o1: { 'k1': 'This is key01', 'k2': 'This is key02' },
        d1: new Date(),
        n1: 1,
        b1: true,
        a1: new Array(500).fill(null).map((_, i) => i)
      },
    })
    equal(created.values.o1.k1, 'This is key01')
    equal(created.values.b1, true)
    equal(created.values.a1.length, 500)

    const updated = await driver.update('Big', created.id, {
      values: { n2: 2, b1: null, o1: { k3: 'This is key03' } }
    })

    deepEqual(updated.values.o1, { k3: 'This is key03' })
  })

  // https://github.com/realglobe-Inc/claydb/issues/12
  it('Handle array', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/handling-array-test.db`
    })
    const user01 = await driver.create('User', { strings: ['a', 'b'] })
    const user02 = await driver.create('User', {})
    const user01Updated = await driver.update('User', user01.id, { strings: ['c'] })

    deepEqual(user01.strings, ['a', 'b'])
    deepEqual(user02.strings, null)
    deepEqual(user01Updated.strings, ['c'])

    await driver.close()
  })
})

/* global describe, before, after, it */
