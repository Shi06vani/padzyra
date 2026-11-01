module.exports = (sequelize, DataTypes) => {
  const FcmToken = sequelize.define('FcmToken', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    platform: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'android' },
  }, { tableName: 'fcm_tokens' });

  FcmToken.associate = (models) => {
    FcmToken.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return FcmToken;
};
