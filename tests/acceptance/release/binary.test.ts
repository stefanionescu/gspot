// Runs the compiled binary of this platform in a planted repository: the embedded configurations, rules and grammars, not the source tree.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import packageManifest from '#cli-package' with { type: 'json' };
// The explicit release suite requires a built binary under dist/.
import { environmentVariables } from '#cli/platform/environment.ts';
import { PLANTED_TIMEOUT_MS, runProcess } from '#tests/support/cli/command.ts';
import releaseTargets from '#cli/platform/release-targets.json' with { type: 'json' };
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const { version: GSPOT_VERSION } = packageManifest;

const root = fileURLToPath(new URL('../../..', import.meta.url));
const requireCli = createRequire(join(root, 'packages/cli/package.json'));
const { familySync } = requireCli('detect-libc') as { familySync: () => string | null };
const libc = process.platform === 'linux' ? familySync() : null;
const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
);
if (host === undefined)
    throw new Error(`Unsupported release test host: ${process.platform} ${process.arch} ${String(libc)}.`);
const BINARY = join(root, 'dist', host.binary);

async function binary(cwd: string, argv: string[]) {
    const environment = Object.fromEntries(Object.entries(environmentVariables()));
    return await runProcess([BINARY, ...argv], {
        cwd,
        env: { ...environment, NO_COLOR: '1', CI: '1', PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) },
        timeoutMs: PLANTED_TIMEOUT_MS,
    });
}

describe('the compiled binary', () => {
    test(
        'prints the package version, installs from its embedded assets and checks a planted script',
        async () => {
            expect(existsSync(BINARY)).toBe(true);
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
            commitAll(sandbox.path);
            expect((await binary(sandbox.path, ['--version'])).stdout.trim()).toBe(GSPOT_VERSION);
            const init = await binary(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'bash',
                '--no-runner',
                '--no-ci',
                '--no-install',
            ]);
            expect(init.code).toBe(0);
            expect(existsSync(join(sandbox.path, '.gspot', 'rules', 'general', 'agent', 'WORKING.md'))).toBe(true);
            expect((await binary(sandbox.path, ['check', '--only', 'bash/shellcheck'])).code).toBe(0);
            const preview = await binary(sandbox.path, ['apply', '--dry-run', '--json']);
            expect(preview.code, preview.stdout).toBe(0);
            expect((JSON.parse(preview.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
        },
        PLANTED_TIMEOUT_MS,
    );
});

test('host binary reads embedded assets after its isolated build checkout is removed', async () => {
    await using sandbox = await testdir();
    const checkout = join(sandbox.path, 'checkout');
    for (const path of [
        'packages/cli',
        'packages/npm',
        'package.json',
        'bun.lock',
        'bunfig.toml',
        'tsconfig.json',
        'LICENSE.md',
        'docs/package.json',
        'packages/eslint-plugin/package.json',
    ]) {
        const destination = join(checkout, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(root, path), destination, {
            recursive: true,
            filter: (source) =>
                !source.split(/[\\/]/u).some((part) => ['node_modules', '.build', 'dist'].includes(part)),
        });
    }
    const options = { cwd: checkout, timeoutMs: 180_000 };
    const installed = await runProcess([process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts'], options);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const built = await runProcess([process.execPath, 'packages/cli/scripts/command.ts'], options);
    expect(built.code, built.stdout + built.stderr).toBe(0);
    const executable = join(sandbox.path, 'gspot');
    copyFileSync(join(checkout, 'dist', host.binary), executable);
    rmSync(checkout, { recursive: true });
    const consumer = join(sandbox.path, 'consumer');
    mkdirSync(consumer);
    writeFileSync(join(consumer, '.editorconfig'), 'root = true\n[*]\nindent_size = 2\n');
    const initialized = await runProcess(
        [
            executable,
            'init',
            '--yes',
            '--configurations',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-install',
            '--json',
        ],
        {
            cwd: consumer,
            timeoutMs: 60_000,
            env: { NODE_PATH: undefined, NODE_OPTIONS: undefined },
        },
    );
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
    expect(existsSync(checkout)).toBe(false);
    const sources = {
        'task.sh': 'shell_command=1\n',
        'task.py': 'shell_command = 1\n',
        'Task.swift': 'let shellCommand = 1\n',
        'task.js': 'export const shellCommand = 1;\n',
        'task.ts': 'export const shellCommand: number = 1;\n',
        'task.tsx': 'export const shellCommand = <div />;\n',
        'task.sql': 'CREATE TABLE shell_table (id integer);\n',
    };
    await createFileTree(consumer, {
        ...sources,
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["bash", "python", "swift", "javascript", "typescript", "sql", "naming"]\n',
    });
    const checked = await runProcess([executable, 'check', '--only', 'naming/identifiers', '--json'], {
        cwd: consumer,
        timeoutMs: 60_000,
        env: { NODE_PATH: undefined, NODE_OPTIONS: undefined },
    });
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as { checks: { status: string; findings: { file: string }[] }[] };
    expect(report.checks.map((check) => check.status)).toStrictEqual(['fail']);
    expect(
        [...new Set(report.checks.flatMap((check) => check.findings.map((finding) => finding.file)))].toSorted(
            (left, right) => left.localeCompare(right),
        ),
    ).toStrictEqual(Object.keys(sources).toSorted((left, right) => left.localeCompare(right)));
}, 360_000);
