module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pad_orders', 'order_number', {
      type: Sequelize.STRING(12),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pad_orders', 'order_number');
  },
};
