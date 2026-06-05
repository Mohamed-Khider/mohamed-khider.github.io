export const LOCAL_PRINT_SERVICE_URL = "http://127.0.0.1:3001";

export async function fetchLocalPrintService(
  path: string,
  init?: RequestInit
): Promise<Response | null> {
  return fetch(`${LOCAL_PRINT_SERVICE_URL}${path}`, init).catch(() => null);
}

export async function fetchLocalFirst(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const localResponse = await fetchLocalPrintService(path, init);
  if (localResponse?.ok) return localResponse;

  const appResponse = await fetch(path, init);
  if (appResponse.ok) return appResponse;

  return localResponse || appResponse;
}
