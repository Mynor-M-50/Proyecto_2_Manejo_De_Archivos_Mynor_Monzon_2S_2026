const mongoose = require('mongoose');
const env = require('./env');

let bucket = null;

// Conecta a MongoDB. autoIndex en false porque los indices
// ya se crean con database/indexes.js
async function connectDB() {
  await mongoose.connect(env.mongoUri, { dbName: env.dbName, autoIndex: false });
  // Bucket de GridFS (colecciones fs.files y fs.chunks)
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
  console.log('Conectado a MongoDB, base: ' + env.dbName);
}

function getBucket() {
  if (!bucket) {
    throw new Error('GridFS no esta inicializado');
  }
  return bucket;
}

module.exports = { connectDB, getBucket };
