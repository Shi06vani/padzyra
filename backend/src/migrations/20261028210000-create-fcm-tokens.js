module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fcm_tokens', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      token: { type: Sequelize.TEXT, allowNull: false, unique: true },
      platform: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'android' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('fcm_tokens', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('fcm_tokens');
  },
};
