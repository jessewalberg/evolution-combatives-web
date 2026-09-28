import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const source = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url))
const script = fileURLToPath(new URL('./prepare-wrangler-deploy.mjs', import.meta.url))

function configAt(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''))
}

test('prepares the selected deployment environment and fails on missing values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wrangler-deploy-'))
  const target = join(directory, 'wrangler.jsonc')
  try {
    copyFileSync(source, target)
    const original = configAt(target)
    const values = Object.fromEntries(
      Object.keys(original.env.preview.vars).map((key) => [key, `value-for-${key}`]),
    )
    const env = {
      ...process.env,
      CLOUDFLARE_ENV: 'preview',
      CLOUDFLARE_ACCOUNT_ID: 'account-123',
      DEPLOY_VARS_JSON: JSON.stringify(values),
    }

    const success = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: 'utf8' })
    assert.equal(success.status, 0, success.stderr)
    const prepared = configAt(target)
    for (const [key, value] of Object.entries(original.env.preview.vars)) {
      assert.equal(prepared.env.preview.vars[key], value === 'REPLACE_AT_DEPLOY'
        ? key === 'CLOUDFLARE_ACCOUNT_ID' ? 'account-123' : values[key]
        : value)
    }
    assert.deepEqual(prepared.vars, original.vars)
    assert.deepEqual(prepared.env.staging.vars, original.env.staging.vars)

    copyFileSync(source, target)
    delete values.VITE_SUPABASE_URL
    const failure = spawnSync(process.execPath, [script], {
      cwd: directory,
      env: { ...env, DEPLOY_VARS_JSON: JSON.stringify(values) },
      encoding: 'utf8',
    })
    assert.notEqual(failure.status, 0)
    assert.deepEqual(configAt(target), original)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
