module.exports = (sequelize, DataTypes) => {
  const Supply = sequelize.define('Supply', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    place: { type: DataTypes.STRING(8), allowNull: false },
    kind: { type: DataTypes.STRING(8), allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'supplies',
    indexes: [{ unique: true, fields: ['user_id', 'place', 'kind'] }],
  });

  Supply.associate = (models) => {
    Supply.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Supply;
};
