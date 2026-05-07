import crypto from 'crypto'

export function signLti11(
  url: string,
  method: string,
  params: Record<string, string>,
  consumerKey: string,
  sharedSecret: string
) {
  params.oauth_consumer_key = consumerKey
  params.oauth_signature_method = 'HMAC-SHA1'
  params.oauth_timestamp = Math.floor(Date.now() / 1000).toString()
  params.oauth_nonce = crypto.randomBytes(16).toString('hex')
  params.oauth_version = '1.0'

  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort()
  const baseStringParts = sortedKeys.map(
    (k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  )

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(baseStringParts.join('&'))
  ].join('&')

  const signingKey = `${encodeURIComponent(sharedSecret)}&`
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  return params
}
