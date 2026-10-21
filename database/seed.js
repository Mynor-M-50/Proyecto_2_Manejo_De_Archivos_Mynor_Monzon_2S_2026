const path = require('path');
const { once } = require('events');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');

try {
  process.loadEnvFile(path.join(__dirname, '..', 'server', '.env'));
} catch (e) {
  console.log('No se encontro server/.env, se usan valores por defecto');
}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'gestion_documental';

// Generador pseudoaleatorio con semilla fija: el seed siempre produce lo mismo
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const daysAgo = (n) => new Date(NOW - n * DAY);
const randomDateBetween = (from, to) =>
  new Date(from.getTime() + rand() * (to.getTime() - from.getTime()));

// ---------- Definiciones ----------

const userDefs = [
  { key: 'admin', name: 'Administrador General', email: 'admin@gestion.com', role: 'admin', password: 'Admin123*' },
  { key: 'ana', name: 'Ana Lopez', email: 'ana@gestion.com', role: 'user', password: 'User123*' },
  { key: 'luis', name: 'Luis Perez', email: 'luis@gestion.com', role: 'user', password: 'User123*' },
];

const folderDefs = [
  { key: 'politicas', owner: 'admin', name: 'Politicas', parent: null },
  { key: 'politicas_rrhh', owner: 'admin', name: 'Recursos Humanos', parent: 'politicas' },
  { key: 'reportes_admin', owner: 'admin', name: 'Reportes', parent: null },
  { key: 'contratos', owner: 'ana', name: 'Contratos', parent: null },
  { key: 'contratos_2026', owner: 'ana', name: '2026', parent: 'contratos' },
  { key: 'informes', owner: 'ana', name: 'Informes', parent: null },
  { key: 'informes_mensuales', owner: 'ana', name: 'Mensuales', parent: 'informes' },
  { key: 'administrativo', owner: 'ana', name: 'Administrativo', parent: null },
  { key: 'borradores', owner: 'ana', name: 'Borradores', parent: null, deleted: true },
  { key: 'proyectos', owner: 'luis', name: 'Proyectos', parent: null },
  { key: 'proyecto_alfa', owner: 'luis', name: 'Alfa', parent: 'proyectos' },
  { key: 'proyecto_beta', owner: 'luis', name: 'Beta', parent: 'proyectos' },
  { key: 'notas', owner: 'luis', name: 'Notas', parent: null },
  { key: 'archivo_viejo', owner: 'luis', name: 'Archivo viejo', parent: null, deleted: true },
];

const F = (owner, folder, name, deleted) => ({ owner, folder, name, deleted: !!deleted });

const fileDefs = [
  // Administrador (12)
  F('admin', 'politicas', 'politica_seguridad.md'),
  F('admin', 'politicas', 'politica_privacidad.txt'),
  F('admin', 'politicas', 'codigo_conducta.md'),
  F('admin', 'politicas', 'politica_obsoleta.txt', true),
  F('admin', 'politicas_rrhh', 'manual_induccion.md'),
  F('admin', 'politicas_rrhh', 'reglamento_interno.txt'),
  F('admin', 'politicas_rrhh', 'vacaciones_2026.txt'),
  F('admin', 'reportes_admin', 'reporte_trimestral.md'),
  F('admin', 'reportes_admin', 'uso_plataforma.txt'),
  F('admin', 'reportes_admin', 'auditoria_accesos.md'),
  F('admin', null, 'bienvenida.md'),
  F('admin', null, 'lista_pendientes.txt'),
  // Ana (20)
  F('ana', 'contratos', 'contrato_servicios_cliente_a.txt'),
  F('ana', 'contratos', 'contrato_servicios_cliente_b.txt'),
  F('ana', 'contratos', 'contrato_confidencialidad.md'),
  F('ana', 'contratos', 'adenda_contrato_a.txt', true),
  F('ana', 'contratos_2026', 'contrato_marco_2026.md'),
  F('ana', 'contratos_2026', 'contrato_soporte_2026.txt'),
  F('ana', 'contratos_2026', 'renovacion_licencias.txt'),
  F('ana', 'informes', 'informe_anual_2025.md'),
  F('ana', 'informes', 'informe_auditoria.md'),
  F('ana', 'informes', 'resumen_ejecutivo.md'),
  F('ana', 'informes_mensuales', 'informe_enero.txt'),
  F('ana', 'informes_mensuales', 'informe_febrero.txt'),
  F('ana', 'informes_mensuales', 'informe_marzo.txt'),
  F('ana', 'informes_mensuales', 'informe_abril.txt'),
  F('ana', 'administrativo', 'acta_reunion_01.md'),
  F('ana', 'administrativo', 'acta_reunion_02.md'),
  F('ana', 'administrativo', 'presupuesto_oficina.txt'),
  F('ana', null, 'notas_personales.txt'),
  F('ana', 'borradores', 'borrador_contrato.txt'),
  F('ana', 'borradores', 'borrador_informe.md'),
  // Luis (18)
  F('luis', 'proyectos', 'plan_general.md'),
  F('luis', 'proyectos', 'cronograma.txt'),
  F('luis', 'proyectos', 'riesgos.md'),
  F('luis', 'proyecto_alfa', 'requisitos_alfa.md'),
  F('luis', 'proyecto_alfa', 'diseno_alfa.md'),
  F('luis', 'proyecto_alfa', 'pruebas_alfa.txt'),
  F('luis', 'proyecto_alfa', 'bitacora_alfa.txt'),
  F('luis', 'proyecto_beta', 'requisitos_beta.md'),
  F('luis', 'proyecto_beta', 'arquitectura_beta.md'),
  F('luis', 'proyecto_beta', 'pendientes_beta.txt', true),
  F('luis', 'notas', 'ideas.md'),
  F('luis', 'notas', 'reuniones.txt'),
  F('luis', 'notas', 'lecturas.md'),
  F('luis', 'notas', 'tareas_semana.txt'),
  F('luis', 'archivo_viejo', 'proyecto_cancelado.md'),
  F('luis', 'archivo_viejo', 'notas_antiguas.txt'),
  F('luis', null, 'readme_personal.md'),
  F('luis', null, 'contactos.txt'),
];

const frases = [
  'Este documento forma parte de la documentacion interna de la organizacion.',
  'Se recomienda revisar su contenido antes de compartirlo con personas externas.',
  'La informacion aqui descrita fue validada por el equipo responsable.',
  'Cualquier cambio debe registrarse en el historial de actividad.',
  'El area administrativa mantiene una copia de respaldo de este archivo.',
  'Los plazos acordados deben cumplirse segun el calendario establecido.',
  'Se detallan los puntos principales tratados en la ultima reunion de trabajo.',
  'Las observaciones pendientes se resolveran durante la siguiente semana.',
  'Este texto es un contenido de ejemplo generado para la carga inicial del sistema.',
  'Los responsables deben confirmar la recepcion de este documento.',
];

const notasMd = [
  'Revisar con el equipo',
  'Actualizar antes de fin de mes',
  'Pendiente de aprobacion',
  'Compartir con las areas involucradas',
  'Archivar al finalizar el proyecto',
];

const commentTexts = [
  'Revise el documento, todo en orden.',
  'Falta ampliar la seccion final.',
  'Podemos reunirnos para revisar este archivo.',
  'Quedo pendiente de la version final.',
  'Buen avance, gracias por compartirlo.',
];

function buildContent(name, ext, ownerName) {
  const base = name.replace(/\.(txt|md)$/, '').replace(/_/g, ' ');
  const title = base.charAt(0).toUpperCase() + base.slice(1);
  const parrafos = [];
  const n = randInt(3, 9);
  for (let i = 0; i < n; i++) {
    parrafos.push(pick(frases) + ' ' + pick(frases));
  }
  if (ext === 'md') {
    return (
      '# ' + title + '\n\nAutor: ' + ownerName + '\n\n## Resumen\n\n' +
      parrafos.join('\n\n') +
      '\n\n## Notas\n\n- ' + pick(notasMd) + '\n- ' + pick(notasMd) + '\n'
    );
  }
  return title.toUpperCase() + '\nAutor: ' + ownerName + '\n\n' + parrafos.join('\n\n') + '\n';
}

async function uploadToGridFS(bucket, filename, buffer, metadata) {
  const stream = bucket.openUploadStream(filename, { metadata });
  stream.end(buffer);
  await once(stream, 'finish');
  return stream.id;
}

// ---------- Programa principal ----------

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const bucket = new GridFSBucket(db);

    // Limpia los datos (los indices se conservan)
    for (const name of ['users', 'folders', 'files', 'shares', 'comments', 'activity_logs', 'fs.files', 'fs.chunks']) {
      await db.collection(name).deleteMany({});
    }

    // Usuarios
    const users = {};
    for (const u of userDefs) {
      const createdAt = daysAgo(70);
      users[u.key] = {
        _id: new ObjectId(),
        name: u.name,
        email: u.email,
        passwordHash: bcrypt.hashSync(u.password, 10),
        role: u.role,
        active: true,
        storageUsed: 0,
        createdAt,
        updatedAt: createdAt,
      };
    }

    // Carpetas (el campo ancestors guarda la ruta completa de padres)
    const folders = {};
    const folderList = [];
    for (const d of folderDefs) {
      const parent = d.parent ? folders[d.parent] : null;
      const createdAt = randomDateBetween(daysAgo(60), daysAgo(40));
      const doc = {
        _id: new ObjectId(),
        ownerId: users[d.owner]._id,
        parentId: parent ? parent._id : null,
        name: d.name,
        ancestors: parent ? [...parent.ancestors, parent._id] : [],
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
      };
      if (d.deleted) {
        doc.deletedAt = randomDateBetween(daysAgo(6), daysAgo(1));
        doc.updatedAt = doc.deletedAt;
      }
      folders[d.key] = doc;
      folderList.push(doc);
    }

    // Archivos: el contenido se sube a GridFS
    const fileList = [];
    for (const d of fileDefs) {
      const owner = users[d.owner];
      const folder = d.folder ? folders[d.folder] : null;
      const ext = d.name.endsWith('.md') ? 'md' : 'txt';
      const mimeType = ext === 'md' ? 'text/markdown' : 'text/plain';
      const buffer = Buffer.from(buildContent(d.name, ext, owner.name), 'utf8');
      const gridfsId = await uploadToGridFS(bucket, d.name, buffer, {
        ownerId: owner._id,
        ext,
        mimeType,
      });
      const createdAt = randomDateBetween(daysAgo(39), daysAgo(8));
      let deletedAt = null;
      if (d.deleted) {
        deletedAt = randomDateBetween(daysAgo(6), daysAgo(1));
      } else if (folder && folder.deletedAt) {
        deletedAt = folder.deletedAt;
      }
      fileList.push({
        _id: new ObjectId(),
        ownerId: owner._id,
        folderId: folder ? folder._id : null,
        name: d.name,
        ext,
        mimeType,
        size: buffer.length,
        gridfsId,
        deletedAt,
        createdAt,
        updatedAt: deletedAt || createdAt,
      });
      owner.storageUsed += buffer.length;
    }

    // Comparticiones
    const permissions = ['read', 'edit', 'comment'];
    const userKeys = Object.keys(users);
    const shareEntries = [];
    let permCounter = 0;

    function addShare(ownerKey, targetKey, resourceType, resource) {
      const createdAt = randomDateBetween(resource.createdAt, daysAgo(1));
      const permission = permissions[permCounter % 3];
      permCounter++;
      shareEntries.push({
        resourceType,
        resource,
        targetKey,
        doc: {
          _id: new ObjectId(),
          ownerId: users[ownerKey]._id,
          sharedWithId: users[targetKey]._id,
          resourceType,
          resourceId: resource._id,
          permission,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    for (const ownerKey of userKeys) {
      const ownerId = users[ownerKey]._id;
      const others = userKeys.filter((k) => k !== ownerKey);
      const ownFiles = fileList.filter((f) => f.ownerId.equals(ownerId) && !f.deletedAt);
      const ownFolders = folderList.filter((f) => f.ownerId.equals(ownerId) && !f.deletedAt);
      ownFiles.slice(0, 6).forEach((f, i) => addShare(ownerKey, others[i % 2], 'file', f));
      ownFiles.slice(0, 3).forEach((f, i) => addShare(ownerKey, others[(i + 1) % 2], 'file', f));
      ownFolders.slice(0, 2).forEach((f, i) => addShare(ownerKey, others[i % 2], 'folder', f));
    }

    // Historial de actividad
    const logList = [];
    function addLog(userId, action, resourceType, resourceId, resourceName, createdAt, details) {
      logList.push({
        _id: new ObjectId(),
        userId,
        action,
        resourceType,
        resourceId,
        resourceName,
        details: details || {},
        createdAt,
      });
    }

    for (const f of folderList) {
      addLog(f.ownerId, 'folder.create', 'folder', f._id, f.name, f.createdAt);
      if (f.deletedAt) addLog(f.ownerId, 'folder.trash', 'folder', f._id, f.name, f.deletedAt);
    }
    for (const f of fileList) {
      addLog(f.ownerId, 'file.upload', 'file', f._id, f.name, f.createdAt);
      if (f.deletedAt) addLog(f.ownerId, 'file.trash', 'file', f._id, f.name, f.deletedAt);
    }

    // Comentarios (los hacen quienes reciben permiso de comentar)
    const commentList = [];
    for (const e of shareEntries) {
      addLog(e.doc.ownerId, 'share.create', e.resourceType, e.resource._id, e.resource.name, e.doc.createdAt, {
        sharedWith: users[e.targetKey].email,
        permission: e.doc.permission,
      });
      if (e.resourceType === 'file' && e.doc.permission === 'comment') {
        const createdAt = randomDateBetween(e.doc.createdAt, new Date(NOW));
        commentList.push({
          _id: new ObjectId(),
          fileId: e.resource._id,
          userId: e.doc.sharedWithId,
          text: pick(commentTexts),
          createdAt,
          updatedAt: createdAt,
        });
        addLog(e.doc.sharedWithId, 'comment.create', 'file', e.resource._id, e.resource.name, createdAt);
      }
      if (e.resourceType === 'file' && e.doc.permission === 'edit') {
        addLog(e.doc.sharedWithId, 'file.edit', 'file', e.resource._id, e.resource.name,
          randomDateBetween(e.doc.createdAt, new Date(NOW)));
      }
    }

    // Lecturas y descargas (algunos archivos con mas operaciones que otros)
    const shareesByFile = {};
    for (const e of shareEntries) {
      if (e.resourceType === 'file') {
        const key = String(e.resource._id);
        (shareesByFile[key] = shareesByFile[key] || []).push(e.doc.sharedWithId);
      }
    }
    const activeFiles = fileList.filter((f) => !f.deletedAt);
    for (const f of activeFiles) {
      const actors = [f.ownerId, ...(shareesByFile[String(f._id)] || [])];
      const n = rand() < 0.2 ? randInt(6, 10) : randInt(0, 4);
      for (let i = 0; i < n; i++) {
        addLog(pick(actors), pick(['file.view', 'file.download']), 'file', f._id, f.name,
          randomDateBetween(f.createdAt, new Date(NOW)));
      }
    }

    // Renombrados y movimientos
    for (let i = 0; i < 5; i++) {
      const f = pick(activeFiles);
      addLog(f.ownerId, 'file.rename', 'file', f._id, f.name,
        randomDateBetween(f.createdAt, new Date(NOW)), { newName: f.name });
    }
    for (let i = 0; i < 4; i++) {
      const f = pick(activeFiles);
      const dest = folderList.find((x) => f.folderId && x._id.equals(f.folderId));
      addLog(f.ownerId, 'file.move', 'file', f._id, f.name,
        randomDateBetween(f.createdAt, new Date(NOW)), { destination: dest ? dest.name : 'raiz' });
    }

    // Inicios de sesion
    for (const u of Object.values(users)) {
      for (let i = 0; i < 4; i++) {
        addLog(u._id, 'auth.login', 'user', u._id, u.name, randomDateBetween(daysAgo(30), new Date(NOW)));
      }
    }

    // Inserta todo
    await db.collection('users').insertMany(Object.values(users));
    await db.collection('folders').insertMany(folderList);
    await db.collection('files').insertMany(fileList);
    await db.collection('shares').insertMany(shareEntries.map((e) => e.doc));
    if (commentList.length > 0) await db.collection('comments').insertMany(commentList);
    await db.collection('activity_logs').insertMany(logList);

    console.log('Seed completado en la base ' + dbName);
    for (const name of ['users', 'folders', 'files', 'shares', 'comments', 'activity_logs', 'fs.files', 'fs.chunks']) {
      console.log(name + ': ' + (await db.collection(name).countDocuments()));
    }
    console.log('Archivos en papelera: ' + fileList.filter((f) => f.deletedAt).length);
    console.log('Carpetas en papelera: ' + folderList.filter((f) => f.deletedAt).length);
    console.log('Usuarios: admin@gestion.com / Admin123*  |  ana@gestion.com y luis@gestion.com / User123*');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Error en el seed:', err.message);
  process.exit(1);
});