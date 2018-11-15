/**
 * Define extra model
 * @function extraModel
 */
'use strict'

const msgpack = require('msgpack-lite')
const Sequelize = require('sequelize')

/** @lends extraModel */
function extraModel (sequelize, resourceName) {
  const modelName = `${resourceName}__Extra`
  const ExtraModel = sequelize.models[modelName] || sequelize.define(modelName, {
    name: {
      comment: 'Name of attribute',
      type: Sequelize.STRING,
    },
    resourceId: {
      required: false,
      type: Sequelize.STRING,
    },
    type: {
      comment: 'Type of attribute',
      type: Sequelize.STRING(64),
    },
    value: {
      allowNull: true,
      comment: 'Extra value',
      type: Sequelize.BLOB('long'),
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
