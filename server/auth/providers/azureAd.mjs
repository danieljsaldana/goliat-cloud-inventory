import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { readAzureUserPhoto } from '../utils/readAzureUserPhoto.mjs';

export function azureAdProvider(settings) {
  return MicrosoftEntraID({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    issuer: settings.issuer,
    authorization: { params: { scope: 'openid profile email User.Read' } },
    profile: async (profile, tokens) => ({
      id: profile.sub,
      name: profile.name || profile.preferred_username,
      email: profile.email || profile.preferred_username,
      image: await readAzureUserPhoto(tokens.access_token),
    }),
  });
}
