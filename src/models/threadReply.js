module.exports = (sequelize, DataTypes) => {
  const ThreadReply = sequelize.define('ThreadReply', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    threadId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: true },
    authorName: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Sister 🌸' },
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    isVip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'thread_replies' });

  ThreadReply.associate = (models) => {
    if (models.Thread) {
      ThreadReply.belongsTo(models.Thread, { foreignKey: 'threadId' });
    }
    if (models.User) {
      ThreadReply.belongsTo(models.User, { foreignKey: 'userId' });
    }
  };

  return ThreadReply;
};
