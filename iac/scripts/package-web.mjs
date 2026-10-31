import { readdir, readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const [directory, output] = process.argv.slice(2);
if (!directory || !output) throw new Error('Uso: node package-web.mjs <standalone-linux> <zip>');
const root = await realpath(resolve(directory));
for (const file of [
  'LICENSE',
  'NOTICE',
  'server.js',
  '.next/BUILD_ID',
  'public/social/cloud-inventory.png',
  'docs/architecture.html',
  'docs/azure-deployment.html',
  'server/migrations/001_initial.sql',
  'server/schema/initial.sql',
])
  await stat(join(root, file));
const crcTable = Uint32Array.from({ length: 256 }, (_, index) =>
  Array.from({ length: 8 }).reduce((value) => (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0), index),
);

async function sourceFiles(relative = '', ancestors = new Set()) {
  const actual = await realpath(join(root, relative));
  if ((actual !== root && !actual.startsWith(`${root}${sep}`)) || ancestors.has(actual))
    throw new Error('Enlace fuera del artefacto o ciclo de directorios.');
  const visited = new Set([...ancestors, actual]);
  const files = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.name.startsWith('.env') || entry.name === '.azure')
      throw new Error('El paquete contiene configuración local.');
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    const target = entry.isSymbolicLink() ? await realpath(join(root, name)) : join(root, name);
    if (!target.startsWith(`${root}${sep}`)) throw new Error('Enlace fuera del artefacto.');
    const metadata = await stat(target);
    if (metadata.isDirectory()) files.push(...(await sourceFiles(name, visited)));
    else if (metadata.isFile()) files.push(name);
    else throw new Error(`Archivo no compatible: ${name}.`);
  }
  return files;
}

const files = await sourceFiles();
if (files.length > 65535) throw new Error('Demasiados archivos para ZIP estándar.');
// Kudu compara las fechas durante la extracción incremental. Una fecha fija puede
// conservar una ruta antigua del mismo tamaño mientras clean elimina sus chunks.
const packagedAt = new Date();
const dosTime =
  (packagedAt.getUTCHours() << 11) |
  (packagedAt.getUTCMinutes() << 5) |
  Math.floor(packagedAt.getUTCSeconds() / 2);
const dosDate =
  ((packagedAt.getUTCFullYear() - 1980) << 9) |
  ((packagedAt.getUTCMonth() + 1) << 5) |
  packagedAt.getUTCDate();
const state = { offset: 0, uncompressed: 0, local: [], central: [] };
for (const path of files) {
  const bytes = await readFile(join(root, path));
  state.uncompressed += bytes.length;
  if (state.uncompressed > 512 * 1024 * 1024)
    throw new Error('El paquete supera 512 MiB; revisa la capacidad F1 antes de desplegar.');
  const compressed = deflateRawSync(bytes);
  const checksum = { value: 0xffffffff };
  for (const byte of bytes)
    checksum.value = (checksum.value >>> 8) ^ crcTable[(checksum.value ^ byte) & 0xff];
  const crc = (checksum.value ^ 0xffffffff) >>> 0;
  const name = Buffer.from(path, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(state.offset, 42);
  state.local.push(local, name, compressed);
  state.central.push(central, name);
  state.offset += local.length + name.length + compressed.length;
}
const central = Buffer.concat(state.central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(state.offset, 16);
await writeFile(resolve(output), Buffer.concat([...state.local, central, end]));
console.log(
  `ZIP Linux: ${output}; ${files.length} archivos, ${Math.ceil(state.uncompressed / 1024 / 1024)} MiB sin comprimir.`,
);
