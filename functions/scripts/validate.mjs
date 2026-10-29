import { readFile, stat } from 'node:fs/promises';
import { validateDocument } from '../src/inventory/validate.mjs';
import contract from '../src/inventory/contract.json' with { type: 'json' };

const path = process.argv[2];
if (!path) throw new Error('Uso: npm run validate -- <fichero.json>');
if ((await stat(path)).size > 64 * 1024 * 1024) throw new Error('Documento demasiado grande.');
validateDocument(JSON.parse(await readFile(path, 'utf8')));
console.log(`Documento completo válido: ${contract.reports.length} informes brutos.`);
