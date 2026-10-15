import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const children = [
  spawn(process.execPath, [join(root, 'server.mjs')], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--configLoader', 'runner'], { cwd: root, stdio: 'inherit' }),
]

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  children.forEach((child) => { if (!child.killed) child.kill() })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
children.forEach((child) => {
  child.on('error', (error) => { console.error(error); shutdown(); process.exitCode = 1 })
  child.on('exit', (code) => { if (code && code !== 0) { shutdown(); process.exitCode = code } })
})
