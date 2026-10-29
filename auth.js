import NextAuth from 'next-auth';
import { authConfiguration } from './server/auth-config.mjs';

export const { handlers, auth, signIn, signOut } = NextAuth(() => authConfiguration());
