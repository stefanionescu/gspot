import { fileURLToPath } from 'node:url';
import { environmentVariables } from '#cli/platform/environment.ts';
import { run } from '#cli/platform/spawn.ts';

const TIMEOUT_MS = 30 * 60 * 1000;
const cwd = process.cwd();
const base = environmentVariables()['GSPOT_CI_BASE'] ?? '';
const command = [process.execPath, fileURLToPath(new URL('../packages/cli/src/main.ts', import.meta.url)), 'check'];
let stdin: string | undefined;
if (base !== '' && !/^(?:0{40}|0{64})$/u.test(base)) {
    if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/iu.test(base)) throw new Error('Invalid CI comparison object.');
    const previous = await run(['git', 'cat-file', '-e', `${base}^{commit}`], { cwd, timeoutMs: TIMEOUT_MS });
    if (previous.code !== 0) throw new Error(`Cannot read CI comparison commit: ${previous.stderr}`);
    const current = await run(['git', 'rev-parse', '--verify', 'HEAD'], { cwd, timeoutMs: TIMEOUT_MS });
    if (current.code !== 0) throw new Error(`Cannot read CI target commit: ${current.stderr}`);
    stdin = `refs/heads/ci ${current.stdout.trim()} refs/heads/ci ${base}\n`;
    command.push('--push', '--', 'origin', '');
}
const result = await run(command, { cwd, timeoutMs: TIMEOUT_MS, ...(stdin === undefined ? {} : { stdin }) });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
