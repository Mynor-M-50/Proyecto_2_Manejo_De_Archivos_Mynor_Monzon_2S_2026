const path = require('path');
const { MongoClient } = require('mongodb');

// Lee la configuracion del mismo .env que usa el servidor
try {
  process.loadEnvFile(path.join(__dirname, '..', 'server', '.env'));
} catch (e) {
  console.log('No se encontro server/.env, se usan valores por defecto');
}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'gestion_documental';

async function createIndexes(db) {
  // users: el correo identifica al usuario
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  // folders: navegar contenido, ancestros y papelera
  await db.collection('folders').createIndex({ ownerId: 1, parentId: 1, deletedAt: 1 });
  await db.collection('folders').createIndex({ ancestors: 1 });

  // files: listado por carpeta, reportes por fecha y tipo, busqueda por nombre
  await db.collection('files').createIndex({ ownerId: 1, folderId: 1, deletedAt: 1 });
  await db.collection('files').createIndex({ ownerId: 1, createdAt: -1 });
  await db.collection('files').createIndex({ ext: 1 });
  await db.collection('files').createIndex({ gridfsId: 1 });
  await db.collection('files').createIndex({ name: 'text' });

  // shares: recursos recibidos, compartidos y verificacion de permisos
  await db.collection('shares').createIndex({ sharedWithId: 1, createdAt: -1 });
  await db.collection('shares').createIndex({ ownerId: 1, createdAt: -1 });
  await db.collection('shares').createIndex({ resourceType: 1, resourceId: 1 });
  await db.collection('shares').createIndex(
    { resourceType: 1, resourceId: 1, sharedWithId: 1 },
    { unique: true }
  );

  // comments: comentarios de un archivo en orden cronologico
  await db.collection('comments').createIndex({ fileId: 1, createdAt: 1 });

  // activity_logs: historial por usuario, por recurso y reportes por tipo
  await db.collection('activity_logs').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('activity_logs').createIndex({ resourceType: 1, resourceId: 1 });
  await db.collection('activity_logs').createIndex({ action: 1 });
  await db.collection('activity_logs').createIndex({ createdAt: -1 });
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    await createIndexes(db);
    console.log('Indices creados en la base ' + dbName);
    for (const name of ['users', 'folders', 'files', 'shares', 'comments', 'activity_logs']) {
      const idx = await db.collection(name).indexes();
      console.log(name + ': ' + idx.map((i) => i.name).join(', '));
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Error creando indices:', err.message);
  process.exit(1);
});