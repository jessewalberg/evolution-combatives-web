import crypto from 'crypto'

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

export type SignatureVerificationResult =
  | { valid: true; timestamp: number }
  | {
      valid: false
      reason: 'missing' | 'malformed' | 'expired' | 'mismatch'
    }

/**
 * Verify Cloudflare Stream's timestamped Webhook-Signature header.
 * The exact, unparsed body is part of the signature source and must not change.
 */
export function verifyCloudflareWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMilliseconds = Date.now()
): SignatureVerificationResult {
  if (!signatureHeader || !secret) {
    return { valid: false, reason: 'missing' }
  }

  const values = new Map<string, string[]>()
  for (const segment of signatureHeader.split(',')) {
    const separator = segment.indexOf('=')
    if (separator <= 0) {
      return { valid: false, reason: 'malformed' }
    }

    const key = segment.slice(0, separator).trim()
    const value = segment.slice(separator + 1).trim()
    if (!key || !value) {
      return { valid: false, reason: 'malformed' }
    }

    values.set(key, [...(values.get(key) || []), value])
  }

  const timestampValues = values.get('time')
  const signatures = values.get('sig1')
  if (
    timestampValues?.length !== 1 ||
    !signatures?.length ||
    !/^\d+$/.test(timestampValues[0])
  ) {
    return { valid: false, reason: 'malformed' }
  }

  const timestamp = Number(timestampValues[0])
  if (!Number.isSafeInteger(timestamp)) {
    return { valid: false, reason: 'malformed' }
  }

  const nowSeconds = Math.floor(nowMilliseconds / 1000)
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: 'expired' }
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestampValues[0]}.${rawBody}`)
    .digest()

  for (const signature of signatures) {
    if (!/^[0-9a-f]{64}$/i.test(signature)) continue

    const supplied = Buffer.from(signature, 'hex')
    if (
      supplied.length === expected.length &&
      crypto.timingSafeEqual(supplied, expected)
    ) {
      return { valid: true, timestamp }
    }
  }

  return { valid: false, reason: 'mismatch' }
}
