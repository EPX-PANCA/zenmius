const assert = require('assert')
const libsodium = require('libsodium-wrappers-sumo')

async function main() {
  await libsodium.ready

  const password = 'zenmius-test-password'
  const plaintext = JSON.stringify({ name: 'Zenmius', version: 1 })
  const salt = libsodium.randombytes_buf(libsodium.crypto_pwhash_SALTBYTES)
  const key = libsodium.crypto_pwhash(
    libsodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    libsodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    libsodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    libsodium.crypto_pwhash_ALG_DEFAULT
  )
  const nonce = libsodium.randombytes_buf(libsodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = libsodium.crypto_secretbox_easy(plaintext, nonce, key)
  const decrypted = libsodium.crypto_secretbox_open_easy(ciphertext, nonce, key)

  assert.strictEqual(libsodium.to_string(decrypted), plaintext)
  console.log('Vault crypto round-trip: passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
