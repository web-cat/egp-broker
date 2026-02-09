import crypto from 'node:crypto'

/**
 * Gets a Gravatar URL for a given email address using SHA-256 hash.
 * This is intended for server-side use.
 *
 * @param email - The email address
 * @param size - The size of the image (default 150)
 * @returns The Gravatar URL
 */
export function getGravatarUrl(email?: string): string {
  if (!email) {
    return 'https://0.gravatar.com/avatar/0000000000000000000000000000000000000000000000000000000000000000?d=robohash'
  }

  const cleanEmail = email.trim().toLowerCase()
  const hash = crypto.createHash('sha256').update(cleanEmail).digest('hex')
  return `https://0.gravatar.com/avatar/${hash}?d=robohash`
}
