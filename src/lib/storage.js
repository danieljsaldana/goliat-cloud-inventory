// Safari privado y algunas políticas corporativas pueden bloquear localStorage.
export function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
