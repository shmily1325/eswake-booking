import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

export async function readRawRequestBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export function verifyLineWebhookSignature(
  rawBody: Buffer,
  signature: string,
  channelSecret: string,
): boolean {
  const expected = createHmac('sha256', channelSecret).update(rawBody).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64')
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
