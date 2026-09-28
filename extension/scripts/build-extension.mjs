import { deflateRawSync } from 'node:zlib'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateExtension } from './validate-extension.mjs'
import { extensionTargets } from './targets.mjs'

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const appFolder = resolve(projectRoot, 'dist/extension-app')
const outputRoot = resolve(projectRoot, 'dist/extensions')
const artifactRoot = resolve(projectRoot, 'artifacts')
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const version = packageJson.version

if (!/^\d+(?:\.\d+){0,3}$/.test(version)) throw new Error(`扩展版本号无效：${version}`)

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipTimestamp(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function filesIn(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = resolve(folder, name)
    return statSync(path).isDirectory() ? filesIn(path) : [path]
  }).sort()
}

function createZip(sourceFolder, targetFile) {
  const files = filesIn(sourceFolder)
  const localParts = []
  const centralParts = []
  let offset = 0
  const timestamp = zipTimestamp(new Date())

  for (const file of files) {
    const name = relative(sourceFolder, file).replaceAll('\\', '/')
    const nameBuffer = Buffer.from(name)
    const content = readFileSync(file)
    const compressed = deflateRawSync(content, { level: 9 })
    const checksum = crc32(content)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(timestamp.time, 10)
    local.writeUInt16LE(timestamp.date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    localParts.push(local, nameBuffer, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(timestamp.time, 12)
    central.writeUInt16LE(timestamp.date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + compressed.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  writeFileSync(targetFile, Buffer.concat([...localParts, ...centralParts, end]))
}

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
mkdirSync(artifactRoot, { recursive: true })

for (const browser of extensionTargets) {
  const target = resolve(outputRoot, browser.id)
  cpSync(appFolder, target, { recursive: true })
  cpSync(resolve(projectRoot, 'extension/icons'), resolve(target, 'icons'), { recursive: true })
  const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'extension/manifests', `${browser.id}.json`), 'utf8'))
  manifest.version = version
  writeFileSync(resolve(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  validateExtension(target, browser.label)
  const artifact = resolve(artifactRoot, `edith-${browser.id}-${version}.zip`)
  createZip(target, artifact)
  console.log(`已生成 ${basename(artifact)}`)
}

rmSync(appFolder, { recursive: true, force: true })
