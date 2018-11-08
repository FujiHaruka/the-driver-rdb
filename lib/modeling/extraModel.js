/**
 * Define extra model
 * @function extraModel
 */
'use strict'

const msgpack = require('msgpack-lite')
const { BLOB, INTEGER, STRING } = require('sequelize')

/** @lends extraModel */
function extraModel (sequelize, resourceName) {
  const modelName = `${resourceName}__Extra`
  const ExtraModel = sequelize.models[modelName] || sequelize.define(modelName, {
    name: {
      comment: 'Name of attribute',
      type: STRING,
    },
    resourceId: {
      type: INTEGER,
      required: false,
    },
    value: {
      allowNull: true,
      comment: 'Extra value',
      type: BLOB('long'),
    },
  }, {
    createdAt: false,
    freezeTableName: true,
    indexes: [
      {
        fields: ['resourceId', 'name'],
        unique: true,
      }
    ],
    updatedAt: false,
  })

  const methods = {}

  Object.assign(ExtraModel, methods)

  return ExtraModel
}

module.exports = extraModel
