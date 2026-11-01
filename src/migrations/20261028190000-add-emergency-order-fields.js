module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('pad_orders');
    if (!tableInfo.items_json) {
      await queryInterface.addColumn('pad_orders', 'items_json', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableInfo.delivery_fee) {
      await queryInterface.addColumn('pad_orders', 'delivery_fee', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }
    if (!tableInfo.total_amount) {
      await queryInterface.addColumn('pad_orders', 'total_amount', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }
    if (!tableInfo.notes) {
      await queryInterface.addColumn('pad_orders', 'notes', {
        type: Sequelize.STRING(200),
        allowNull: true,
      });
    }
    if (!tableInfo.idempotency_key) {
      await queryInterface.addColumn('pad_orders', 'idempotency_key', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
    await queryInterface.changeColumn('pad_orders', 'kind', {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
    await queryInterface.changeColumn('pad_orders', 'size', {
      type: Sequelize.STRING(40),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('pad_orders');
    if (tableInfo.idempotency_key) await queryInterface.removeColumn('pad_orders', 'idempotency_key');
    if (tableInfo.notes) await queryInterface.removeColumn('pad_orders', 'notes');
    if (tableInfo.total_amount) await queryInterface.removeColumn('pad_orders', 'total_amount');
    if (tableInfo.delivery_fee) await queryInterface.removeColumn('pad_orders', 'delivery_fee');
    if (tableInfo.items_json) await queryInterface.removeColumn('pad_orders', 'items_json');
  },
};
