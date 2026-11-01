module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true },
      email: { type: Sequelize.STRING(254), allowNull: false, unique: true },
      role: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'girl' },
      pin_hash: { type: Sequelize.STRING(128) },
      pin_fails: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pin_locked_until: { type: Sequelize.DATE },
      discreet: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      pad_size: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'regular' },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      cycle_length: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 28 },
      period_length: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      quiet_start: { type: Sequelize.STRING(5) },
      quiet_end: { type: Sequelize.STRING(5) },
      leave_home: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '08:00' },
      lunch: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '13:00' },
      heat: { type: Sequelize.STRING(5) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('otp_codes', {
      id: { type: Sequelize.UUID, primaryKey: true },
      email: { type: Sequelize.STRING(254), allowNull: false },
      purpose: { type: Sequelize.STRING(12), allowNull: false },
      code_hash: { type: Sequelize.STRING(128), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      used_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('sessions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      unlocked_until: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('cycles', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      secret: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('supplies', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      place: { type: Sequelize.STRING(8), allowNull: false },
      kind: { type: Sequelize.STRING(8), allowNull: false },
      qty: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('supplies', ['user_id', 'place', 'kind'], { unique: true });

    await queryInterface.createTable('trips', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('pad_uses', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      used_on: { type: Sequelize.DATEONLY, allowNull: false },
      place: { type: Sequelize.STRING(8), allowNull: false },
      kind: { type: Sequelize.STRING(8), allowNull: false },
      qty: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.STRING(8), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('shops', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(80), allowNull: false },
      area: { type: Sequelize.STRING(80) },
      address: { type: Sequelize.STRING(160), allowNull: false },
      lat: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
      lng: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      code: { type: Sequelize.STRING(6), allowNull: false, unique: true },
      opens_at: { type: Sequelize.STRING(5) },
      closes_at: { type: Sequelize.STRING(5) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('saved_shops', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      shop_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'shops', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('saved_shops', ['user_id', 'shop_id'], { unique: true });

    await queryInterface.createTable('pad_orders', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      shop_id: {
        type: Sequelize.UUID,
        references: { model: 'shops', key: 'id' },
        onDelete: 'SET NULL',
      },
      kind: { type: Sequelize.STRING(8), allowNull: false },
      size: { type: Sequelize.STRING(10), allowNull: false },
      qty: { type: Sequelize.INTEGER, allowNull: false },
      address: { type: Sequelize.STRING(160) },
      phone: { type: Sequelize.STRING(20) },
      status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'pending' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('push_subscriptions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      endpoint: { type: Sequelize.TEXT, allowNull: false, unique: true },
      p256dh: { type: Sequelize.STRING(255), allowNull: false },
      auth: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('notification_sends', {
      id: { type: Sequelize.UUID, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      kind: { type: Sequelize.STRING(12), allowNull: false },
      day: { type: Sequelize.DATEONLY, allowNull: false },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      token_enc: { type: Sequelize.TEXT, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('notification_sends', ['user_id', 'kind', 'day'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notification_sends');
    await queryInterface.dropTable('push_subscriptions');
    await queryInterface.dropTable('pad_orders');
    await queryInterface.dropTable('saved_shops');
    await queryInterface.dropTable('shops');
    await queryInterface.dropTable('pad_uses');
    await queryInterface.dropTable('trips');
    await queryInterface.dropTable('supplies');
    await queryInterface.dropTable('cycles');
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('otp_codes');
    await queryInterface.dropTable('users');
  },
};
