module.exports = (sequelize, DataTypes) => {
  const DayLog = sequelize.define('DayLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    dayKey: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    secret: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: 'day_logs' });

  DayLog.associate = (models) => {
    DayLog.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return DayLog;
};
