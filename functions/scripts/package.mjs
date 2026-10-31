import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

async function sourceFiles(directory, prefix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const rows = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new Error('El paquete no admite enlaces simbólicos.');
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      rows.push(...(await sourceFiles(new URL(`${entry.name}/`, directory), `${name}/`)));
    else if (entry.isFile() && /\.(mjs|json)$/.test(entry.name)) rows.push(name);
    else throw new Error(`Archivo inesperado en src: ${name}.`);
  }
  return rows;
}

function crc32(bytes) {
  const state = { value: 0xffffffff };
  for (const byte of bytes) {
    state.value ^= byte;
    state.value = Array.from({ length: 8 }).reduce(
      (value) => (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0),
      state.value,
    );
  }
  return (state.value ^ 0xffffffff) >>> 0;
}

// ZIP pequeño sin dependencias de sistema. Allowlist: nunca empaquetar settings locales.
const files = [
  'LICENSE',
  'NOTICE',
  'host.json',
  'package.json',
  'package-lock.json',
  ...(await sourceFiles(new URL('src/', root), 'src/')),
];
const state = { offset: 0, local: [], central: [] };
for (const path of files) {
  const bytes = await readFile(
    new URL(path, ['LICENSE', 'NOTICE'].includes(path) ? new URL('../', root) : root),
  );
  const compressed = deflateRawSync(bytes);
  const name = Buffer.from(path, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc32(bytes), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc32(bytes), 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(state.offset, 42);
  state.local.push(local, name, compressed);
  state.central.push(central, name);
  state.offset += local.length + name.length + compressed.length;
}
const directory = Buffer.concat(state.central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(state.offset, 16);
await mkdir(new URL('.azure/', root), { recursive: true });
const output = new URL('.azure/function.zip', root);
await writeFile(output, Buffer.concat([...state.local, directory, end]));
console.log(
  `Paquete: ${fileURLToPath(output)} (${files.length} archivos, sin settings ni node_modules).`,
);
