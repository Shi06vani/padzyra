const env = require('../config/env');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && env.isProduction ? 'Internal server error' : err.message;

  const body = {
    error: {
      message,
    },
  };

  if (!env.isProduction && err.stack && status === 500) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
