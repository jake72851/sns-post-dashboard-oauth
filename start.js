const app_web = require('./app_web');
const http = require('http');
const mongoose = require('mongoose');
const CONF = require('./config');
const FUNC = require('./func');

// Setup Mongoose DB
mongoose.Promise = global.Promise;
mongoose
  .connect(CONF.db.url, CONF.db.option)
  .then(() => console.log('connnect DB success'))
  .catch((err) => console.log('could not connect to the database.\n' + err));

// Create HTTP server.
if (CONF.server.port.http) {
  const httpServer = http.createServer(app_web);
  httpServer.listen(CONF.server.port.http, () =>
    FUNC.log(`Http listens on port ${CONF.server.port.http}`),
  );
  httpServer.on('error', (err) => {
    if (err.syscall !== 'listen') {
      throw err;
    }
    FUNC.log(err.message);
  });
}

// Start Route
app_web.startRoute();
