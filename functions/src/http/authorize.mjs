import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UUID } from '../config.mjs';

const providers = new Map();

export async function authorize(request, config, action = 'Generate', verifier = jwtVerify, keys) {
  if (
    !UUID.test(config.tenantId) ||
    !UUID.test(config.audience) ||
    !config.allowedClients.length ||
    config.allowedClients.some((id) => !UUID.test(id))
  ) {
    throw Object.assign(
      new Error('Configura la API de Entra ID y los clientes permitidos para habilitar HTTP.'),
      { status: 503 },
    );
  }
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '');
  if (!match)
    throw Object.assign(new Error('Se requiere un access token de Entra ID.'), { status: 401 });
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;
  if (!keys && !providers.has(issuer))
    providers.set(
      issuer,
      createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`),
      ),
    );
  const result = await verifier(match[1], keys || providers.get(issuer), {
    issuer,
    audience: config.audience,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'tid', 'oid', 'azp'],
    clockTolerance: 5,
  });
  const p = result.payload;
  const scope = action === 'Publish' ? 'Inventory.Publish' : 'Inventory.Refresh';
  const appCall = p.idtyp === 'app' && p.scp === undefined;
  const userCall =
    p.idtyp !== 'app' && typeof p.scp === 'string' && p.scp.split(' ').includes(scope);
  if (
    p.tid !== config.tenantId ||
    p.ver !== '2.0' ||
    !UUID.test(p.oid) ||
    !config.allowedClients.includes(typeof p.azp === 'string' ? p.azp.toLowerCase() : '') ||
    !Array.isArray(p.roles) ||
    !p.roles.includes(`Inventory.${action}`) ||
    (!appCall && !userCall)
  ) {
    throw Object.assign(new Error('El solicitante no tiene permiso para esta operación.'), {
      status: 403,
    });
  }
  return { objectId: p.oid, clientId: p.azp };
}
