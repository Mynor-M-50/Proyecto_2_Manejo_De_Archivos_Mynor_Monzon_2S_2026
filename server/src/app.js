const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors({ origin: env.clientUrl, exposedHeaders: ['Content-Disposition'] }));
// El limite es mayor al de por defecto porque se puede editar el contenido de un archivo (hasta 5 MB)
app.use(express.json({ limit: '6mb' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
