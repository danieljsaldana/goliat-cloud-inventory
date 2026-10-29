import { loadEnvFile } from 'node:process';

export function loadLocalEnv(path = '.env') {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
