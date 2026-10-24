const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');

// Conecta a la base y levanta el servidor HTTP
async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log('Servidor escuchando en http://localhost:' + env.port);
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
