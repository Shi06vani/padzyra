module.exports = (sequelize, DataTypes) => {
  const PadOrder = sequelize.define('PadOrder', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    shopId: { type: DataTypes.UUID },
    kind: { type: DataTypes.STRING(40), allowNull: false },
    size: { type: DataTypes.STRING(40), allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    address: { type: DataTypes.STRING(160) },
    phone: { type: DataTypes.STRING(20) },
    orderNumber: { type: DataTypes.STRING(12) },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' },
    itemsJson: { type: DataTypes.TEXT },
    deliveryFee: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalAmount: { type: DataTypes.INTEGER, defaultValue: 0 },
    notes: { type: DataTypes.STRING(200) },
    idempotencyKey: { type: DataTypes.STRING(64) },
  }, { tableName: 'pad_orders' });

  PadOrder.associate = (models) => {
    PadOrder.belongsTo(models.User, { foreignKey: 'userId' });
    PadOrder.belongsTo(models.Shop, { foreignKey: 'shopId' });
  };

  return PadOrder;
};
