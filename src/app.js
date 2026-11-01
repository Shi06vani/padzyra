const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.set('trust proxy', env.isProduction ? 1 : false);
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.use('/api/v1', routes);
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.use((req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(notFound);
app.use(errorHandler);

module.exports = app;
