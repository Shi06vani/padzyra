module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. ai_sources table
    await queryInterface.createTable('ai_sources', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      organization: { type: Sequelize.STRING(120), allowNull: false },
      url: { type: Sequelize.STRING(512), allowNull: false },
      topic: { type: Sequelize.STRING(64), allowNull: false },
      review_status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'reviewed' },
      review_date: { type: Sequelize.STRING(32), allowNull: false },
      summary_en: { type: Sequelize.TEXT, allowNull: false },
      summary_hi: { type: Sequelize.TEXT, allowNull: false },
      key_points: { type: Sequelize.TEXT, allowNull: true },
      emergency_flags: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 2. ai_conversations table
    await queryInterface.createTable('ai_conversations', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Consultation' },
      language: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'en' },
      use_cycle_history: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 3. ai_messages table
    await queryInterface.createTable('ai_messages', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'ai_conversations', key: 'id' },
        onDelete: 'CASCADE',
      },
      sender: { type: Sequelize.STRING(16), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      urgency: { type: Sequelize.STRING(24), allowNull: false, defaultValue: 'normal' },
      red_flags: { type: Sequelize.TEXT, allowNull: true },
      cited_sources: { type: Sequelize.TEXT, allowNull: true },
      follow_up_question: { type: Sequelize.TEXT, allowNull: true },
      follow_up_options: { type: Sequelize.TEXT, allowNull: true },
      self_care_steps: { type: Sequelize.TEXT, allowNull: true },
      when_to_see_doctor: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 4. Add consent & language preferences to users table
    const tableInfo = await queryInterface.describeTable('users');
    if (!tableInfo.ai_cycle_consent) {
      await queryInterface.addColumn('users', 'ai_cycle_consent', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!tableInfo.ai_language) {
      await queryInterface.addColumn('users', 'ai_language', {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: 'en',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_messages');
    await queryInterface.dropTable('ai_conversations');
    await queryInterface.dropTable('ai_sources');
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.ai_cycle_consent) {
      await queryInterface.removeColumn('users', 'ai_cycle_consent');
    }
    if (tableInfo.ai_language) {
      await queryInterface.removeColumn('users', 'ai_language');
    }
  },
};
