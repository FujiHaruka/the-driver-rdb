/**
 * Define extra model
 * @function extraModel
 */
'use strict'

const msgpack = require('msgpack-lite')
const { STRING, BLOB, INTEGER } = require('sequelize')

/** @lends extraModel */
function extraModel (sequelize, resourceName) {
  const modelName = `${resourceName}__Extra`
  const ExtraModel = sequelize.models[modelName] || sequelize.define(modelName, {
    resourceId: {
      type: INTEGER,
    },
    name: {
      comment: 'Name of attribute',
      type: STRING,
    },
    value: {
      comment: 'Extra value',
      type: BLOB('long'),
      allowNull: true
    }
  }, {
    createdAt: false,
    freezeTableName: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['resourceId', 'name']
      }
    ]
  })

  const methods = {}

  Object.assign(ExtraModel, methods)

  return ExtraModel
}

module.exports = extraModel

