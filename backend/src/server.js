const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');

const { dispatchAllAlerts } = require('./services/alerts');

const { ensureSourcesSeeded } = require('./services/medicalKnowledge');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connection established.');
    await ensureSourcesSeeded();
  } catch (error) {
    console.error('PostgreSQL is not ready:', error.message);
    console.error('Set DB_PASSWORD in .env, then run npm run db:migrate.');
  }

  const alertTimer = setInterval(() => {
    dispatchAllAlerts().catch(() => {});
  }, 5 * 60 * 1000);

  const server = app.listen(env.port, () => {
    console.log(`Padzyra API listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing server.`);
    clearInterval(alertTimer);
    server.close(async () => {
      try {
        await sequelize.close();
      } catch (error) {
        console.error('Error closing database connection:', error.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
