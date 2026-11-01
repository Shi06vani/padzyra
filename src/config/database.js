const env = require('./env');

function dialectOptions() {
  if (!env.db.ssl) {
    return {};
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

function buildConfig(database) {
  const base = {
    dialect: 'postgres',
    logging: env.db.logging ? console.log : false,
    define: {
      underscored: true,
      timestamps: true,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: dialectOptions(),
  };

  if (env.db.url && env.isProduction) {
    return {
      ...base,
      use_env_variable: 'DATABASE_URL',
    };
  }

  return {
    ...base,
    username: env.db.username,
    password: String(env.db.password ?? ''),
    database,
    host: env.db.host,
    port: env.db.port,
  };
}

module.exports = {
  development: buildConfig(env.db.name),
  test: buildConfig(env.db.testName),
  production: buildConfig(env.db.name),
};
