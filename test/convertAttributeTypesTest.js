/**
 * Test for convertAttributeTypes.
 * Runs with mocha.
 */
'use strict'

const { DataTypes } = require('clay-constants')
const convertAttributeTypes = require('../lib/helpers/convertAttributeTypes')
const { ok, strictEqual: equal, deepStrictEqual: deepEqual } = require('assert')

describe('convert-attribute-types', () => {
  before(() => {
  })

  after(() => {
  })

  it('Do test', async () => {
    const restored = convertAttributeTypes.restore(
      convertAttributeTypes({
        num01: DataTypes.NUMBER,
        bool01: DataTypes.BOOLEAN,
      })
    )
    console.log(restored)
  })
})

/* global describe, before, after, it */
