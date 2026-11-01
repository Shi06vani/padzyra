module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('trips');
    if (!tableInfo.name) {
      await queryInterface.addColumn('trips', 'name', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!tableInfo.destination) {
      await queryInterface.addColumn('trips', 'destination', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
    if (!tableInfo.activities) {
      await queryInterface.addColumn('trips', 'activities', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      });
    }
    if (!tableInfo.checklist) {
      await queryInterface.addColumn('trips', 'checklist', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('trips');
    if (tableInfo.checklist) await queryInterface.removeColumn('trips', 'checklist');
    if (tableInfo.activities) await queryInterface.removeColumn('trips', 'activities');
    if (tableInfo.destination) await queryInterface.removeColumn('trips', 'destination');
    if (tableInfo.name) await queryInterface.removeColumn('trips', 'name');
  },
};
