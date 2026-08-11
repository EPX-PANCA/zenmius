const { execFileSync, spawnSync } = require('child_process')
const readline = require('readline')

const candidates = {
  rdp: process.platform === 'win32' ? ['wfreerdp'] : ['xfreerdp3', 'xfreerdp'],
  vnc: ['vncviewer', 'gvncviewer', 'vinagre']
}

function findCommand(names) {
  for (const name of names) {
    try {
      const command = process.platform === 'win32' ? 'where' : 'which'
      const result = execFileSync(command, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      if (result.trim()) return name
    } catch {
      // Try the next supported binary name.
    }
  }
  return null
}

function getInstallCommand() {
  if (process.platform === 'darwin') return ['brew', ['install', 'freerdp', 'tigervnc']]
  if (process.platform === 'linux') {
    if (findCommand(['apt-get'])) return ['sudo', ['apt-get', 'install', '-y', 'freerdp3-x11', 'tigervnc-viewer']]
    if (findCommand(['dnf'])) return ['sudo', ['dnf', 'install', '-y', 'freerdp', 'tigervnc']]
    if (findCommand(['pacman'])) return ['sudo', ['pacman', '-S', '--needed', 'freerdp', 'tigervnc']]
  }
  return null
}

function printStatus() {
  const missing = Object.entries(candidates)
    .filter(([, names]) => !findCommand(names))
    .map(([type, names]) => `${type}: ${names.join(' / ')}`)

  if (missing.length === 0) {
    console.log('[Remote] RDP and VNC clients are available.')
    return false
  }

  console.warn('[Remote] Missing optional system dependencies:')
  missing.forEach(item => console.warn(`  - ${item}`))
  const install = getInstallCommand()
  if (install) {
    console.warn(`[Remote] To install them, run: ${install[0]} ${install[1].join(' ')}`)
  } else {
    console.warn('[Remote] Install FreeRDP and a VNC viewer using your OS package manager.')
  }
  return true
}

async function confirmAndInstall() {
  if (!printStatus()) return
  const install = getInstallCommand()
  if (!install) return
  if (!process.stdin.isTTY) {
    console.warn('[Remote] No interactive terminal; skipping system package installation.')
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => rl.question('Install these optional packages now? [y/N] ', resolve))
  rl.close()
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('[Remote] Installation skipped.')
    return
  }

  const result = spawnSync(install[0], install[1], { stdio: 'inherit' })
  if (result.status !== 0) process.exitCode = result.status || 1
}

if (process.argv.includes('--install')) {
  confirmAndInstall().catch(error => {
    console.error('[Remote] Dependency setup failed:', error.message)
    process.exitCode = 1
  })
} else {
  printStatus()
}
