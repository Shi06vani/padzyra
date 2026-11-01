module.exports = (sequelize, DataTypes) => {
  const Thread = sequelize.define('Thread', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    authorName: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Anonymous Sis 🌸' },
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    tag: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'general' },
    feeling: { type: DataTypes.STRING(40), defaultValue: '😣 Cramping' },
    likesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    hugsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    repliesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isVip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'threads' });

  Thread.associate = (models) => {
    if (models.User) {
      Thread.belongsTo(models.User, { foreignKey: 'userId' });
    }
    if (models.ThreadReply) {
      Thread.hasMany(models.ThreadReply, { foreignKey: 'threadId', onDelete: 'CASCADE' });
    }
  };

  return Thread;
};
