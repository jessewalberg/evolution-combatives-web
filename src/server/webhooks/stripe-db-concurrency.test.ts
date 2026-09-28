// @vitest-environment node
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const runFile = promisify(execFile)
const databaseUrl = process.env.TEST_DATABASE_URL

async function query(sql: string) {
  const { stdout } = await runFile('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', databaseUrl!, '-c', sql])
  return stdout.trim()
}

function openSession() {
  const child = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', databaseUrl!], { stdio: 'pipe' })
  let output = ''
  let errors = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { errors += chunk.toString() })
  return {
    send(sql: string) { child.stdin.write(`${sql}\n`) },
    async waitFor(marker: string) {
      const deadline = Date.now() + 5000
      while (!output.includes(marker)) {
        if (child.exitCode !== null || Date.now() >= deadline) {
          throw new Error(`psql session did not emit ${marker}: ${errors}`)
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      return output
    },
    close() { child.stdin.end(); child.kill() },
  }
}

it.skipIf(!databaseUrl)('serializes concurrent first subscriptions across PostgreSQL transactions', async () => {
  if (await query(`SELECT to_regclass('public.subscriptions') IS NULL`) !== 't') {
    throw new Error('TEST_DATABASE_URL must point to an empty disposable database')
  }
  const bootstrap = `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY, subscription_tier text);
    CREATE TABLE IF NOT EXISTS public.subscriptions (
      user_id uuid NOT NULL, platform text NOT NULL, external_subscription_id text NOT NULL,
      tier text NOT NULL, status text NOT NULL, stripe_subscription_id text UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(), stripe_customer_id text,
      stripe_created_at timestamptz, stripe_last_event_created_at timestamptz,
      current_period_start timestamptz, current_period_end timestamptz,
      cancel_at_period_end boolean, canceled_at timestamptz, updated_at timestamptz,
      UNIQUE (user_id, platform)
    );
  `
  await query(bootstrap)
  for (const path of [
    new URL('../../../supabase/migrations/20260928000000_record_stripe_subscription_created.sql', import.meta.url),
    new URL('../../../supabase/migrations/20260928120000_stripe_checkout_reservation_monotonic_events.sql', import.meta.url),
  ]) {
    await runFile('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', databaseUrl!, '-f', path.pathname])
  }

  const userId = randomUUID()
  await query(`INSERT INTO public.profiles (id) VALUES ('${userId}')`)
  const payload = (id: string, created: number) => JSON.stringify({
    user_id: userId, tier: 'tier1', external_subscription_id: id,
    stripe_subscription_id: id, stripe_created_at: new Date(created * 1000).toISOString(), status: 'active',
  })
  const leaseA = await query(`SELECT public.acquire_stripe_subscription_lease('sub_a')`)
  const leaseB = await query(`SELECT public.acquire_stripe_subscription_lease('sub_b')`)
  expect(leaseA).toBeTruthy()
  expect(leaseB).toBeTruthy()
  const event = (id: string, created: number, time: number, lease: string) =>
    `SELECT public.apply_stripe_subscription_event('${payload(id, created)}'::jsonb, '${randomUUID()}', ${time}, true, '${lease}'::uuid);`

  const first = openSession()
  const second = openSession()
  try {
    first.send(`BEGIN; ${event('sub_a', 1700000000, 1700000100, leaseA)} SELECT 'first_ready';`)
    await first.waitFor('first_ready')
    second.send(`SELECT 'pid:' || pg_backend_pid();`)
    const pidOutput = await second.waitFor('pid:')
    const pid = Number(pidOutput.match(/pid:(\d+)/)?.[1])
    expect(pid).toBeGreaterThan(0)
    second.send(`${event('sub_b', 1700000001, 1700000101, leaseB)} SELECT 'second_done';`)

    let waiting = false
    for (let attempt = 0; attempt < 100; attempt++) {
      waiting = (await query(`SELECT wait_event_type || ':' || wait_event FROM pg_stat_activity WHERE pid = ${pid}`)) === 'Lock:advisory'
      if (waiting) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    expect(waiting).toBe(true)
    first.send('COMMIT;')
    await second.waitFor('second_done')

    expect(await query(`SELECT stripe_subscription_id FROM public.subscriptions WHERE user_id = '${userId}'`)).toBe('sub_a')
    expect(await query(`SELECT stripe_subscription_id || ':' || needs_refund FROM public.stripe_orphan_subscriptions WHERE user_id = '${userId}'`)).toBe('sub_b:true')
    expect(await query(`SELECT count(*) FROM public.stripe_webhook_events WHERE event_id IN (SELECT event_id FROM public.stripe_orphan_subscriptions WHERE user_id = '${userId}')`)).toBe('1')
  } finally {
    first.close()
    second.close()
    await query(`SELECT public.release_stripe_subscription_lease('sub_a', '${leaseA}'::uuid)`)
    await query(`SELECT public.release_stripe_subscription_lease('sub_b', '${leaseB}'::uuid)`)
  }
}, 15000)
