module.exports = (sequelize, DataTypes) => {
  const Cycle = sequelize.define('Cycle', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    secret: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: 'cycles' });

  Cycle.associate = (models) => {
    Cycle.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Cycle;
};
