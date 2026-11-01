module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    planId: { type: DataTypes.STRING(32), allowNull: false },
    planName: { type: DataTypes.STRING(64), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    paymentMethod: { type: DataTypes.STRING(32), defaultValue: 'upi' },
    transactionId: { type: DataTypes.STRING(64) },
    startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'subscriptions' });

  Subscription.associate = (models) => {
    if (models.User) {
      Subscription.belongsTo(models.User, { foreignKey: 'userId' });
    }
  };

  return Subscription;
};
