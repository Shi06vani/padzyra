module.exports = (sequelize, DataTypes) => {
  const AiConversation = sequelize.define(
    'AiConversation',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
      },
      title: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'Consultation',
      },
      language: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'en',
      },
      useCycleHistory: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'use_cycle_history',
      },
    },
    { tableName: 'ai_conversations', underscored: true }
  );

  AiConversation.associate = (models) => {
    AiConversation.belongsTo(models.User, { foreignKey: 'userId' });
    AiConversation.hasMany(models.AiMessage, {
      foreignKey: 'conversationId',
      as: 'messages',
      onDelete: 'CASCADE',
    });
  };

  return AiConversation;
};
