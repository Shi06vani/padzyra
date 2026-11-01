module.exports = (sequelize, DataTypes) => {
  const PushSubscription = sequelize.define('PushSubscription', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    endpoint: { type: DataTypes.TEXT, allowNull: false, unique: true },
    p256dh: { type: DataTypes.STRING(255), allowNull: false },
    auth: { type: DataTypes.STRING(255), allowNull: false },
  }, { tableName: 'push_subscriptions' });

  PushSubscription.associate = (models) => {
    PushSubscription.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return PushSubscription;
};
