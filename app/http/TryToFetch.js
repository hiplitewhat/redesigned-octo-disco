export async function tryToFetch_status(url) {
  if (!url || !String(url).trim()) return false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.status;
  } catch {
    return false;
  }
}

export async function tryToFetch(url) {
  return (await tryToFetch_status(url)) === 200;
}
