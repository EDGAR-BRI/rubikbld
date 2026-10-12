import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const rootDir = process.cwd()
const fullIconsPath = path.join(rootDir, 'node_modules/@iconify-json/lucide/icons.json')

if (!fs.existsSync(fullIconsPath)) {
  console.warn('[@iconify-json/lucide] not found in node_modules, skipping offline icons bundling.')
  process.exit(0)
}

const full = JSON.parse(fs.readFileSync(fullIconsPath, 'utf8'))

// Scan all lucide:icon-name references in src/
let raw = ''
try {
  raw = execSync('grep -roh "lucide:[a-zA-Z0-9-]*" src/', { encoding: 'utf8' })
} catch {
  raw = ''
}

const usedNames = new Set(
  raw
    .split('\n')
    .map(s => s.replace('lucide:', '').trim())
    .filter(Boolean),
)

// Add standard control icons used dynamically or conditionally
const extraIcons = [
  'rotate-cw',
  'rotate-ccw',
  'minus',
  'plus',
  'maximize-2',
  'minimize-2',
  'zoom-in',
  'zoom-out',
  'check',
  'check-circle',
  'check-circle-2',
  'x',
  'x-circle',
  'eye',
  'eye-off',
  'refresh-cw',
  'copy',
]

extraIcons.forEach(n => usedNames.add(n))

const collection = {
  prefix: 'lucide',
  icons: {},
  width: full.width,
  height: full.height,
}

for (const name of usedNames) {
  if (full.icons[name]) {
    collection.icons[name] = full.icons[name]
  } else if (full.aliases && full.aliases[name]) {
    const parent = full.aliases[name].parent
    if (full.icons[parent]) {
      collection.icons[name] = full.icons[parent]
    }
  }
}

const outDir = path.join(rootDir, 'src/plugins')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'offlineIcons.json')
fs.writeFileSync(outFile, JSON.stringify(collection))

console.log(`[offline-icons] Bundled ${Object.keys(collection.icons).length} icons to src/plugins/offlineIcons.json (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`)
