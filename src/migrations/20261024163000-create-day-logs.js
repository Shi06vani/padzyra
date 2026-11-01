module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('day_logs', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      day_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      secret: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('day_logs', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('day_logs');
  },
};
