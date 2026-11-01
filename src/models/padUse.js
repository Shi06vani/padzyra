module.exports = (sequelize, DataTypes) => {
  const PadUse = sequelize.define('PadUse', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    usedOn: { type: DataTypes.DATEONLY, allowNull: false },
    place: { type: DataTypes.STRING(8), allowNull: false },
    kind: { type: DataTypes.STRING(8), allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(8), allowNull: false },
  }, { tableName: 'pad_uses' });

  PadUse.associate = (models) => {
    PadUse.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return PadUse;
};
