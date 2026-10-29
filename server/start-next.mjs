import { loadLocalEnv } from './load-env.mjs';

loadLocalEnv();
await import('next/dist/bin/next');
