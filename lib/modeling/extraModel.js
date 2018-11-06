/**
 * Define extra model
 * @function extraModel
 */
'use strict'

/** @lends extraModel */
function extraModel (sequelize, resourceName) {
  const modelName = `${resourceName}__Extra`
  const ExtraModel = sequelize.models[modelName] || sequelize.define(modelName, {
    // TODO
  }, {
    createdAt: false,
    freezeTableName: true,
    updatedAt: false,
  })

  return ExtraModel
}

module.exports = extraModel

