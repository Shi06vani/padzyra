module.exports = (sequelize, DataTypes) => {
  const Shop = sequelize.define('Shop', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    area: { type: DataTypes.STRING(80) },
    address: { type: DataTypes.STRING(160), allowNull: false },
    lat: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
    lng: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    code: { type: DataTypes.STRING(6), allowNull: false, unique: true },
    opensAt: { type: DataTypes.STRING(5) },
    closesAt: { type: DataTypes.STRING(5) },
  }, { tableName: 'shops' });

  Shop.associate = (models) => {
    Shop.belongsTo(models.User, { foreignKey: 'userId' });
    Shop.hasMany(models.SavedShop, { foreignKey: 'shopId', onDelete: 'CASCADE' });
    Shop.hasMany(models.PadOrder, { foreignKey: 'shopId', onDelete: 'SET NULL' });
  };

  return Shop;
};
