module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    role: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'girl' },
    pinHash: { type: DataTypes.STRING(128) },
    pinFails: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pinLockedUntil: { type: DataTypes.DATE },
    discreet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    padSize: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'regular' },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    cycleLength: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 28 },
    periodLength: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    quietStart: { type: DataTypes.STRING(5) },
    quietEnd: { type: DataTypes.STRING(5) },
    leaveHome: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '08:00' },
    lunch: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '13:00' },
    heat: { type: DataTypes.STRING(5) },
    aiCycleConsent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'ai_cycle_consent' },
    aiLanguage: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'en', field: 'ai_language' },
  }, { tableName: 'users' });

  User.associate = (models) => {
    User.hasMany(models.Session, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.Cycle, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.DayLog, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.Supply, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.Trip, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.PadUse, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.PushSubscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.NotificationSend, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasOne(models.Shop, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.SavedShop, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.PadOrder, { foreignKey: 'userId', onDelete: 'CASCADE' });
    User.hasMany(models.FcmToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
    if (models.Thread) {
      User.hasMany(models.Thread, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
    if (models.Subscription) {
      User.hasMany(models.Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
    if (models.AiConversation) {
      User.hasMany(models.AiConversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
  };

  return User;
};
