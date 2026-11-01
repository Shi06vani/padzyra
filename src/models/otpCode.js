module.exports = (sequelize, DataTypes) => {
  const OtpCode = sequelize.define('OtpCode', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false },
    purpose: { type: DataTypes.STRING(12), allowNull: false },
    codeHash: { type: DataTypes.STRING(128), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    usedAt: { type: DataTypes.DATE },
  }, { tableName: 'otp_codes' });

  return OtpCode;
};
