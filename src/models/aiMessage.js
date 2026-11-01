module.exports = (sequelize, DataTypes) => {
  const AiMessage = sequelize.define(
    'AiMessage',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'conversation_id',
      },
      sender: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      urgency: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'normal',
      },
      redFlags: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'red_flags',
      },
      citedSources: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'cited_sources',
      },
      followUpQuestion: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'follow_up_question',
      },
      followUpOptions: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'follow_up_options',
      },
      selfCareSteps: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'self_care_steps',
      },
      whenToSeeDoctor: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'when_to_see_doctor',
      },
    },
    { tableName: 'ai_messages', underscored: true }
  );

  AiMessage.associate = (models) => {
    AiMessage.belongsTo(models.AiConversation, { foreignKey: 'conversationId' });
  };

  return AiMessage;
};
