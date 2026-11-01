module.exports = (sequelize, DataTypes) => {
  const Trip = sequelize.define('Trip', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: true },
    destination: { type: DataTypes.STRING(120), allowNull: true },
    activities: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    checklist: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  }, { tableName: 'trips' });

  Trip.associate = (models) => {
    Trip.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Trip;
};
