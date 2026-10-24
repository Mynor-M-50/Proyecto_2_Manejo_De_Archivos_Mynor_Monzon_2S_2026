const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MB = 1024 * 1024;

const env = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'gestion_documental',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
  // Espacio asignado por defecto a cada usuario nuevo (en MB en el .env, en bytes aqui)
  defaultQuota: (Number(process.env.DEFAULT_QUOTA_MB) || 50) * MB,
};

if (!env.jwtSecret) {
  console.error('Falta JWT_SECRET en el archivo server/.env');
  process.exit(1);
}

module.exports = env;
