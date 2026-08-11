const assert = require('assert')
const { Client } = require('ssh2')
const { stringToFlags } = require('ssh2/lib/protocol/SFTP')

assert.strictEqual(typeof Client, 'function')
assert.strictEqual(stringToFlags('r'), 1)
assert.strictEqual(stringToFlags('w'), 26)
console.log('SSH2/SFTP smoke test: passed')
