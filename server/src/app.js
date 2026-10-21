const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors({ origin: env.clientUrl, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
