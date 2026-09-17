import { spawn } from 'node:child_process'
import { INVOCATION_TIMEOUT_MILLISECONDS, OUTPUT_LIMIT_BYTES } from '@config/limits'
import type { Answer, Invocation } from 'types/run'

export async function invoke(invocation: Invocation): Promise<Answer> {
  const program = invocation.command[0]
  if (program === undefined) {
    throw new Error('invoke received an empty command')
  }
  const startedAt = performance.now()
  const limit = invocation.outputLimit ?? OUTPUT_LIMIT_BYTES
  const timeoutMs = invocation.timeoutMs ?? INVOCATION_TIMEOUT_MILLISECONDS

  const child = spawn(program, invocation.command.slice(1), {
    cwd: invocation.cwd,
    env: invocation.env === undefined ? process.env : { ...process.env, ...invocation.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const out = collect(child.stdout, limit)
  const err = collect(child.stderr, limit)
  writeStdin(child, invocation.stdin)

  return await settle(child, { program, startedAt, timeoutMs, out, err })
}

type Streams = { readonly out: Collected; readonly err: Collected }
type Settlement = Streams & {
  readonly program: string
  readonly startedAt: number
  readonly timeoutMs: number
}

function settle(child: ReturnType<typeof spawn>, at: Settlement): Promise<Answer> {
  return new Promise<Answer>((resolve) => {
    const since = (): number => Math.round(performance.now() - at.startedAt)
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ outcome: 'timeout', timeoutMs: at.timeoutMs, durationMs: since() })
    }, at.timeoutMs)
    timer.unref()

    child.on('error', (reason: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      resolve(
        reason.code === 'ENOENT'
          ? { outcome: 'missing', program: at.program, durationMs: since() }
          : { outcome: 'broke', message: reason.message, durationMs: since() },
      )
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({
        outcome: 'ran',
        code: code ?? (signal === null ? 1 : 128),
        stdout: at.out.text(),
        stderr: at.err.text(),
        truncated: at.out.truncated() || at.err.truncated(),
        durationMs: since(),
      })
    })
  })
}

function writeStdin(child: ReturnType<typeof spawn>, text: string | undefined): void {
  const stdin = child.stdin as NonNullable<typeof child.stdin>
  stdin.on('error', () => {})
  if (text !== undefined) stdin.write(text)
  stdin.end()
}

type Collected = { text: () => string; truncated: () => boolean }

function collect(stream: NodeJS.ReadableStream | null, limit: number): Collected {
  const chunks: Buffer[] = []
  let size = 0
  let over = false
  stream?.on('data', (chunk: Buffer) => {
    if (over) return
    if (size + chunk.length > limit) {
      chunks.push(chunk.subarray(0, limit - size))
      size = limit
      over = true
      return
    }
    chunks.push(chunk)
    size += chunk.length
  })
  return { text: () => Buffer.concat(chunks).toString('utf8'), truncated: () => over }
}

export function stdoutOf(answer: Answer, what: string): string {
  if (answer.outcome === 'ran' && answer.code === 0) return answer.stdout
  throw new Error(`${what} failed: ${describe(answer)}`)
}

export function describe(answer: Answer): string {
  switch (answer.outcome) {
    case 'ran':
      return answer.code === 0 ? 'exit 0' : `exit ${answer.code}: ${firstLine(answer.stderr)}`
    case 'missing':
      return `${answer.program} is not installed`
    case 'timeout':
      return `no answer within ${answer.timeoutMs}ms`
    case 'broke':
      return answer.message
  }
}

function firstLine(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim().length > 0)
  return line === undefined ? '(no output)' : line.trim()
}
