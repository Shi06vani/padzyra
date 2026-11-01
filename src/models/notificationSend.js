module.exports = (sequelize, DataTypes) => {
  const NotificationSend = sequelize.define('NotificationSend', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(12), allowNull: false },
    day: { type: DataTypes.DATEONLY, allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    tokenEnc: { type: DataTypes.TEXT, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'notification_sends',
    indexes: [{ unique: true, fields: ['user_id', 'kind', 'day'] }],
  });

  NotificationSend.associate = (models) => {
    NotificationSend.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return NotificationSend;
};
