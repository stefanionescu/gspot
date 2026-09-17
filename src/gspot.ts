#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CommanderError } from 'commander'
import { buildProgram } from '@/commands/tree'
import { unknownCommand } from '@/commands/mistake'
import { COMMANDS } from '@config/commands'

const PACKAGE_ROOT = join(import.meta.dirname, '..')

async function version(): Promise<string> {
  const manifest = JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
    version: string
  }
  return manifest.version
}

async function main(argv: readonly string[]): Promise<0 | 1 | 2> {
  const { program, code } = buildProgram({
    cwd: process.cwd(),
    presetsRoot: join(PACKAGE_ROOT, 'presets'),
    version: await version(),
    interactive: process.stdout.isTTY === true && process.env['CI'] === undefined,
    write: (line) => process.stdout.write(`${line}\n`),
  })
  await program.parseAsync([...argv])
  return code()
}

try {
  process.exitCode = await main(process.argv)
} catch (reason) {
  process.exitCode = exitCodeFor(reason)
}

function exitCodeFor(reason: unknown): 0 | 2 {
  if (!(reason instanceof CommanderError)) {
    process.stderr.write(`${(reason as Error).message}\n`)
    return 2
  }
  if (['commander.helpDisplayed', 'commander.version', 'commander.help'].includes(reason.code)) {
    return 0
  }
  const lines =
    reason.code === 'commander.unknownCommand'
      ? unknownCommand(process.argv[2] ?? '', COMMANDS)
      : [reason.message.replace(/^error: /u, '')]
  for (const line of lines) process.stderr.write(`${line}\n`)
  return 2
}
