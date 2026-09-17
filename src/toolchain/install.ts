import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { assetUrl, hostKey } from '@/toolchain/lock'

import type { Asset, Lock, LockedTool } from 'types/toolchain'
import { BIN_CACHE_DIRECTORY } from '@config/paths'
import { BIN_DIRECTORY } from '@config/paths'
import type { InstallOutcome } from 'types/toolchain'
import { invoke } from '@/run/invoke'

export async function install(root: string, lock: Lock): Promise<InstallOutcome> {
  const key = hostKey()
  const installed: string[] = []
  const verified: string[] = []
  const skipped: { tool: string; why: string }[] = []
  const failures: { tool: string; why: string }[] = []
  const recorded: string[] = []

  await mkdir(join(root, BIN_CACHE_DIRECTORY), { recursive: true })
  for (const tool of lock.tools.values()) {
    if (tool.provider !== 'download') {
      skipped.push({ tool: tool.id, why: `${tool.provider} provides it, not gspot` })
      continue
    }
    const asset = tool.assets.get(key)
    if (asset === undefined) {
      skipped.push({ tool: tool.id, why: `the lock names no asset for ${key}` })
      continue
    }
    const result = await place(root, tool, asset, key)
    if (result.failure !== undefined) failures.push({ tool: tool.id, why: result.failure })
    else if (result.fetched) installed.push(tool.id)
    else verified.push(tool.id)
    if (result.recordedHash !== undefined) recorded.push(tool.id)
  }
  return { installed, verified, skipped, failures, recorded }
}

type Placement = {
  readonly fetched: boolean
  readonly failure?: string

  readonly recordedHash?: string
}

async function place(root: string, tool: LockedTool, asset: Asset, key: string): Promise<Placement> {
  const url = assetUrl(asset.url, tool.version, key)
  const cached = join(root, BIN_CACHE_DIRECTORY, `${tool.id}-${tool.version}${suffixOf(url)}`)

  const existing = await hashOf(cached)
  if (existing !== null && existing === asset.sha256) {
    return { fetched: false, ...(await unpack(root, tool, cached)) }
  }
  if (existing !== null) await rm(cached, { force: true })

  const downloaded = await download(url, cached)
  if (downloaded !== null) return { fetched: true, failure: downloaded }

  const got = await hashOf(cached)
  if (got === null) return { fetched: true, failure: 'the download left no file' }
  if (asset.sha256.length > 0 && got !== asset.sha256) {
    await rm(cached, { force: true })
    return {
      fetched: true,
      failure:
        `the checksum does not match.\n` +
        `    lock says  ${asset.sha256}\n` +
        `    download   ${got}\n` +
        '    gspot never proceeds on a mismatch.',
    }
  }
  const unpacked = await unpack(root, tool, cached)
  return { fetched: true, ...unpacked, ...(asset.sha256.length === 0 ? { recordedHash: got } : {}) }
}

async function download(url: string, target: string): Promise<string | null> {
  try {
    const answer = await fetch(url, { redirect: 'follow' })
    if (!answer.ok) return `${url} answered ${answer.status}`
    await writeFile(target, Buffer.from(await answer.arrayBuffer()))
    return null
  } catch (reason) {
    return `${url} did not answer: ${(reason as Error).message}`
  }
}

async function unpack(root: string, tool: LockedTool, cached: string): Promise<{ failure?: string }> {
  const bin = join(root, BIN_DIRECTORY)
  await mkdir(bin, { recursive: true })
  const target = join(bin, tool.id)

  const flags = archiveFlags(cached)
  if (flags === null) {
    await writeFile(target, await readFile(cached))
    await chmod(target, 0o755)
    return {}
  }

  const staging = join(root, BIN_CACHE_DIRECTORY, `${tool.id}-unpacked`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const answer = await invoke({ command: [...flags, cached], cwd: staging })
  if (answer.outcome !== 'ran' || answer.code !== 0) {
    return { failure: `the archive did not unpack: ${cached}` }
  }
  const found = await findBinary(staging, tool.id)
  if (found === null) return { failure: `the archive holds no file named ${tool.id}` }
  await rename(found, target)
  await chmod(target, 0o755)
  await rm(staging, { recursive: true, force: true })
  return {}
}

function archiveFlags(path: string): readonly string[] | null {
  if (path.endsWith('.tar.gz') || path.endsWith('.tgz')) return ['tar', '-xzf']
  if (path.endsWith('.tar.xz')) return ['tar', '-xJf']
  if (path.endsWith('.tar.bz2')) return ['tar', '-xjf']
  if (path.endsWith('.zip')) return ['unzip', '-oq']
  return null
}

async function findBinary(directory: string, id: string): Promise<string | null> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  const found = entries.find((entry) => entry.isFile() && entry.name === id)
  return found === undefined ? null : join(found.parentPath, found.name)
}

function suffixOf(url: string): string {
  const name = url.slice(url.lastIndexOf('/') + 1)
  for (const suffix of ['.tar.gz', '.tar.xz', '.tar.bz2', '.tgz', '.zip']) {
    if (name.endsWith(suffix)) return suffix
  }
  return ''
}

async function hashOf(path: string): Promise<string | null> {
  try {
    return createHash('sha256').update(await readFile(path)).digest('hex')
  } catch {
    return null
  }
}
