const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appSecret: process.env.APP_SECRET || (nodeEnv === 'production' ? '' : 'dev-only-change-me'),
  vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
  tz: process.env.TZ_NAME || 'Asia/Kolkata',
  db: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD == null ? '' : String(process.env.DB_PASSWORD),
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || 'padzyra',
    testName: process.env.DB_NAME_TEST || 'padzyra_test',
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true',
    url: process.env.DATABASE_URL || '',
  },
};

if (env.isProduction && !env.appSecret) {
  throw new Error('APP_SECRET is required in production');
}

module.exports = env;
