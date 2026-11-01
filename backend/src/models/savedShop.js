module.exports = (sequelize, DataTypes) => {
  const SavedShop = sequelize.define('SavedShop', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    shopId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: 'saved_shops',
    indexes: [{ unique: true, fields: ['user_id', 'shop_id'] }],
  });

  SavedShop.associate = (models) => {
    SavedShop.belongsTo(models.User, { foreignKey: 'userId' });
    SavedShop.belongsTo(models.Shop, { foreignKey: 'shopId' });
  };

  return SavedShop;
};
