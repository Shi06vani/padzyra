module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('threads', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      author_name: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'Anonymous Sis 🌸' },
      is_anonymous: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      content: { type: Sequelize.TEXT, allowNull: false },
      tag: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'general' },
      feeling: { type: Sequelize.STRING(40), defaultValue: '😣 Cramping' },
      likes_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      hugs_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      replies_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_vip: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('thread_replies', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      thread_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'threads', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      author_name: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'Sister 🌸' },
      is_anonymous: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      content: { type: Sequelize.TEXT, allowNull: false },
      is_vip: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('subscriptions', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      plan_id: { type: Sequelize.STRING(32), allowNull: false },
      plan_name: { type: Sequelize.STRING(64), allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active' },
      payment_method: { type: Sequelize.STRING(32), defaultValue: 'upi' },
      transaction_id: { type: Sequelize.STRING(64) },
      start_date: { type: Sequelize.DATE, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('thread_replies');
    await queryInterface.dropTable('threads');
    await queryInterface.dropTable('subscriptions');
  },
};
