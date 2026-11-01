module.exports = (sequelize, DataTypes) => {
  const AiSource = sequelize.define(
    'AiSource',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      organization: { type: DataTypes.STRING(120), allowNull: false },
      url: { type: DataTypes.STRING(512), allowNull: false },
      topic: { type: DataTypes.STRING(64), allowNull: false },
      reviewStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'reviewed',
        field: 'review_status',
      },
      reviewDate: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: 'review_date',
      },
      summaryEn: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'summary_en',
      },
      summaryHi: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'summary_hi',
      },
      keyPoints: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'key_points',
      },
      emergencyFlags: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'emergency_flags',
      },
    },
    { tableName: 'ai_sources', underscored: true }
  );

  return AiSource;
};
