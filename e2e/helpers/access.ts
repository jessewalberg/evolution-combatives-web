const appOrigin = new URL(process.env.VITE_APP_URL || 'http://localhost:3000').origin

export function appAccessHeaders(url: string | URL): Record<string, string> {
  if (new URL(url, appOrigin).origin !== appOrigin) return {}

  const id = process.env.CF_ACCESS_CLIENT_ID
  const secret = process.env.CF_ACCESS_CLIENT_SECRET
  return id && secret
    ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret }
    : {}
}

export function isAppOrigin(url: URL): boolean {
  return url.origin === appOrigin
}
