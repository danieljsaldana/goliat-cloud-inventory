export async function loadMembers(signal) {
  const response = await fetch('/api/admin/members/', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'members_unavailable');
  return data;
}

export async function updateMemberRole(input) {
  const response = await fetch('/api/admin/members/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'members_unavailable');
  return data;
}
