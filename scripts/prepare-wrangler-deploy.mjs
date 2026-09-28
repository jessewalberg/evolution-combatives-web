import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const path = resolve('wrangler.jsonc')
const config = JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''))
const envName = process.env.CLOUDFLARE_ENV
const selected = envName ? config.env?.[envName]?.vars : config.vars
const values = JSON.parse(process.env.DEPLOY_VARS_JSON || '{}')

if (!selected || typeof values !== 'object' || values === null || Array.isArray(values)) {
  throw new Error('Deployment configuration is missing')
}

for (const [key, value] of Object.entries(selected)) {
  if (value !== 'REPLACE_AT_DEPLOY') continue
  const replacement = key === 'CLOUDFLARE_ACCOUNT_ID'
    ? process.env.CLOUDFLARE_ACCOUNT_ID
    : values[key]
  if (typeof replacement !== 'string' || !replacement.trim() || replacement === 'REPLACE_AT_DEPLOY') {
    throw new Error(`Missing deploy value for ${key}`)
  }
  selected[key] = replacement
}

if (Object.values(selected).some((value) => typeof value === 'string' && value.includes('REPLACE_AT_DEPLOY'))) {
  throw new Error('Unresolved deploy placeholder')
}

writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)
