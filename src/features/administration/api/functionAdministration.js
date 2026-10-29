export async function loadAdministration(signal, hours = 24) {
  const response = await fetch(`/api/admin/function/?hours=${hours}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('administration_unavailable');
  return response.json();
}

export function saveSchedule(input) {
  return fetch('/api/admin/function/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function saveTags(input) {
  return fetch('/api/admin/function/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, action: 'tags' }),
    signal: AbortSignal.timeout(45000),
  });
}
