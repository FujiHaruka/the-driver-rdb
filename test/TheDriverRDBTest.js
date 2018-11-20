/**
 * Test for TheDriverRDB.
 * Runs with mocha.
 */
'use strict'

const TheDriverRDB = require('../lib/TheDriverRDB')
const { ok, strictEqual: equal, deepStrictEqual: deepEqual } = require('assert')
const { unlinkAsync } = require('asfs')
const clayLump = require('clay-lump')

describe('the-driver-r-d-b', () => {
  before(() => {
  })

  after(() => {
  })

  it('Do test', async () => {
    const storage = `${__dirname}/../tmp/hoge-2.db`
    await unlinkAsync(storage).catch(() => null)
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: storage,
      // logging: console.log,
    })
    ok(!driver.closed)
    await driver.drop('User')

    {
      const created = await driver.create('User', { name: 123, })
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
        const updated = await driver.update('User', created.id, {
          hoge: 1,
          name: null,
          icon: '🍣🍺'
        })
        equal(updated.hoge, 1)
        equal(updated.id, created.id)
        equal(updated.icon, '🍣🍺')
        ok((await driver.one('User', created.id)).name === null)
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

    deepEqual(
      await driver.resources(),
      [{ name: 'User', domain: null }],
    )
    await driver.close()
    ok(driver.closed)
  })

  it('Multiple create', async () => {
    const storage = `${__dirname}/../tmp/hoge-2.db`
    await unlinkAsync(storage).catch(() => null)
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: storage,
      // logging: console.log,
    })

    {
      const user01 = await driver.create('User', { a: 1 })
      const user01updated = await driver.update('User', user01.id, { b: 2 })
      const user02 = await driver.create('User', { c: 3 })
      equal(user01updated.a, 1)
      equal(user01updated.b, 2)
      equal(user02.c, 3)
    }
    await driver.drop('User')
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
      (await driver.list('Box', { filter: { name: ['b01', 'b03'] } })).meta.total,
      1,
    )

    equal(
      (await driver.list('Box', { sort: 'name' })).entities[0].id,
      created01.id,
    )
    equal(
      (await driver.list('Box', { sort: '-name' })).entities[0].id,
      created02.id
    )

    ok(
      await driver.list('Box', { sort: '-__unknown_prop__' })
    )

    equal(
      (await driver.list('Box', { sort: '-$$at' })).entities[0].id,
      created02.id,
    )

    equal(
      (await driver.list('Box', { sort: '$$at' })).entities[0].id,
      created01.id,
    )

    equal(
      (await driver.list('Box', {
        filter: {
          $$at: { $gt: new Date() }
        }
      })).entities.length,
      0,
    )
    equal(
      (await driver.list('Box', {
        filter: {
          $$at: { $lte: new Date() }
        }
      })).entities.length,
      2,
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

    await driver.update('Box', box02.id, { v: 2 })
  })

  it('Handling object and array', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/obj-array-test.db`
    })
    await driver.drop('Big')

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
    await driver.drop('User')
    const user01 = await driver.create('User', { strings: ['a', 'b'] })
    const user02 = await driver.create('User', {})
    const user01Updated = await driver.update('User', user01.id, { strings: ['c'] })

    deepEqual(user01.strings, ['a', 'b'])
    deepEqual(user02.strings, null)
    deepEqual(user01Updated.strings, ['c'])

    await driver.close()
  })

  it('Date type comparison', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/date-compare.db`
    })
    await driver.drop('A')
    await driver.create('A', {
      at: new Date('2000-01-01'),
    })
    await driver.create('A', {
      at: new Date('2020-01-01'),
    })
    await driver.create('A', {
      at: new Date('1980-01-01'),
      x: 1,
    })
    const list = await driver.list('A', { filter: { at: { $gt: new Date('1999-01-01') } } })
    equal(list.meta.total, 2)
  })

  it('Invalid filter', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/empty-filter.db`
    })
    await driver.drop('A')
    await driver.drop('B')
    const a1 = await driver.create('A', { i: 1 })
    const a2 = await driver.create('A', { i: 2 })
    const b1 = await driver.create('B', { i: 1 })

    equal(
      (await driver.list('A', { filter: { 'b': b1, i: 1 } })).entities.length,
      0,
    )
    await driver.close()
  })

  it('Multiple extra', async () => {
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/multiple-extra.db`
    })
    await driver.drop('Poster')

    const poster01 = await driver.create('Poster', {
      attr01: new Array(2000).fill('a').join('_'),
      attr02: new Array(2000).fill('b').join('_'),
      attr03: {
        c: new Array(10).fill(null).map((_, i) => ({ i })),
      }
    })

    const { entities, meta } = await driver.list('Poster')
    deepEqual({ offset: 0, limit: 100, total: 1, length: 1 }, meta)

    const updated = await driver.update('Poster', poster01.id, {
      attr03: {
        c: new Array(2000).fill(null).map((_, i) => ({ i })),
      }
    })
    equal(updated.attr03.c.length, 2000)

    {
      const updated02 = await driver.update('Poster', poster01.id, { attr02: 123 })
      equal(updated02.attr02, 123)
    }
  })

  it('Multiple instance', async () => {
    const driver01 = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/multiple-instance.db`
    })
    await driver01.drop('HOGE')
    const created = await driver01.create('HOGE', { foo: 'bar' })
    equal(created.foo, 'bar')

    const created02 = await driver01.create('HOGE', { foo: 'baz' })
    equal(created02.foo, 'baz')
    equal((await driver01.one('HOGE', created.id)).foo, 'bar')
    equal((await driver01.one('HOGE', created02.id)).foo, 'baz')

    const created03 = await driver01.create('HOGE', {
      a: 1,
      b: 2,
    })
    equal(created03.a, 1)
    equal(created03.b, 2)

    equal(
      (await driver01.list('HOGE')).entities[0].foo,
      'bar'
    )

    await driver01.close()

    const driver02 = new TheDriverRDB({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/multiple-instance.db`
    })
    equal(
      (await driver02.list('HOGE')).entities[0].foo,
      'bar',
    )

    await driver02.create('HOGE', { foo2: 'bar2' })
    await driver02.close()
  })

  it('sqlite/issues/5', async () => {
    const storage = `${__dirname}/../sqlite-issue-5.db`
    await unlinkAsync(storage).catch(() => null)
    const driver = new TheDriverRDB({
      dialect: 'sqlite',
      storage: storage,
      // logging: console.log,
    })
    const lump = clayLump('hec-eye-alpha', { driver, })
    let User = lump.resource('user')
    await User.drop()
    let created = await User.create({ name: 'hoge' })
    let found = await User.first({ name: 'hoge' })
    let destroyed = await User.destroy(found.id)
    equal(destroyed, 1)
    let mustBeNull = await User.first({ name: 'hoge' })
    ok(!mustBeNull)
  })

  it('A lot of create', async () => {
    for (let i = 0; i < 2; i++) {
      const storage = `${__dirname}/../tmp/a-lot-of-create.db`
      await unlinkAsync(storage)
      for (let j = 0; j < 2; j++) {
        const driver01 = new TheDriverRDB({
          dialect: 'sqlite',
          storage
        })
        await driver01.drop('hoge')
        for (let i = 0; i < 30; i++) {
          await driver01.create('hoge', { i })
        }
        await driver01.close()
      }
    }
  })
})

/* global describe, before, after, it */
