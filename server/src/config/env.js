const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'gestion_documental',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
};

if (!env.jwtSecret) {
  console.error('Falta JWT_SECRET en el archivo server/.env');
  process.exit(1);
}

module.exports = env;
