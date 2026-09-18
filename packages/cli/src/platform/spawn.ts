// Spawning without a shell: Bun.spawn, and cross-spawn for the .cmd shims npm writes on Windows.
import crossSpawn from 'cross-spawn';

export type SpawnResult = { code: number; stdout: string; stderr: string; missing: boolean; duration: number };

export type SpawnOptions = { cwd: string; env?: Record<string, string>; stdin?: string; timeoutMs?: number };

const isWindows = process.platform === 'win32';

function environment(extra?: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
    return { ...env, ...(extra ?? {}) };
}

/** Runs a command to completion and returns its output. A missing executable is reported, never thrown. */
export async function run(command: string[], options: SpawnOptions): Promise<SpawnResult> {
    const started = performance.now();
    const [executable, ...args] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (isWindows) {
        return new Promise((resolve) => {
            const child = crossSpawn(executable, args, {
                cwd: options.cwd,
                env: environment(options.env),
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const out: Buffer[] = [];
            const err: Buffer[] = [];
            child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
            child.stderr?.on('data', (chunk: Buffer) => err.push(chunk));
            child.on('error', (error: NodeJS.ErrnoException) => {
                resolve({
                    code: 127,
                    stdout: '',
                    stderr: error.message,
                    missing: error.code === 'ENOENT',
                    duration: performance.now() - started,
                });
            });
            child.on('close', (code) => {
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(out).toString('utf8'),
                    stderr: Buffer.concat(err).toString('utf8'),
                    missing: false,
                    duration: performance.now() - started,
                });
            });
            if (options.stdin !== undefined) child.stdin?.end(options.stdin);
            else child.stdin?.end();
        });
    }
    try {
        const proc = Bun.spawn(command, {
            cwd: options.cwd,
            env: environment(options.env),
            stdin: options.stdin !== undefined ? new TextEncoder().encode(options.stdin) : 'ignore',
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const timer = options.timeoutMs !== undefined ? setTimeout(() => proc.kill(), options.timeoutMs) : undefined;
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        if (timer !== undefined) clearTimeout(timer);
        return { code, stdout, stderr, missing: false, duration: performance.now() - started };
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return {
            code: 127,
            stdout: '',
            stderr: (error as Error).message,
            missing: code === 'ENOENT',
            duration: performance.now() - started,
        };
    }
}

/** Synchronous form for git plumbing and version probes. */
export function runSync(command: string[], options: SpawnOptions): SpawnResult {
    const started = performance.now();
    const [executable, ...args] = command;
    if (executable === undefined) throw new Error('An empty command cannot run.');
    if (isWindows) {
        const result = crossSpawn.sync(executable, args, {
            cwd: options.cwd,
            env: environment(options.env),
            input: options.stdin,
            encoding: 'utf8',
        });
        const missing = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
        return {
            code: result.status ?? (missing ? 127 : 1),
            stdout: String(result.stdout ?? ''),
            stderr: String(result.stderr ?? result.error?.message ?? ''),
            missing,
            duration: performance.now() - started,
        };
    }
    try {
        const result = Bun.spawnSync(command, {
            cwd: options.cwd,
            env: environment(options.env),
            stdin: options.stdin !== undefined ? new TextEncoder().encode(options.stdin) : 'ignore',
            stdout: 'pipe',
            stderr: 'pipe',
        });
        return {
            code: result.exitCode,
            stdout: result.stdout.toString(),
            stderr: result.stderr.toString(),
            missing: false,
            duration: performance.now() - started,
        };
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return {
            code: 127,
            stdout: '',
            stderr: (error as Error).message,
            missing: code === 'ENOENT',
            duration: performance.now() - started,
        };
    }
}

/** Runs git in a directory and returns stdout, or undefined when git fails. */
export function git(root: string, args: string[]): string | undefined {
    const result = runSync(['git', ...args], { cwd: root });
    return result.code === 0 ? result.stdout : undefined;
}
