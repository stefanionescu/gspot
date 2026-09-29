// Runs the compiled binary of this platform in a planted repository: the embedded configurations, rules and grammars, not the source tree.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import type * as DetectLibc from 'detect-libc';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import releaseTargets from '#npm-targets' with { type: 'json' };
import packageManifest from '#cli-package' with { type: 'json' };
import { environmentVariables } from '#cli/platform/environment.ts';
import { cpSync, rmSync, mkdirSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { EMBEDDED_INIT_ARGS, BUILD_CHECKOUT_PATHS, EMBEDDED_PARSER_SOURCES } from '#tests/config/release.ts';

const { version: GSPOT_VERSION } = packageManifest;

const root = fileURLToPath(new URL('../../..', import.meta.url));
const requireCli = createRequire(join(root, 'packages/cli/package.json'));
const { familySync: libcFamily } = requireCli('detect-libc') as typeof DetectLibc;
const libc = process.platform === 'linux' ? libcFamily() : null;
const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
);
if (host === undefined)
    throw new Error(`Unsupported release test host: ${process.platform} ${process.arch} ${String(libc)}.`);
// The explicit release suite requires a built binary under dist/.
const BINARY = join(root, 'dist', host.binary);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Five runs of the installed binary share the environment and the tool PATH; one owner keeps them.
async function binary(cwd: string, argv: string[]) {
    const environment = Object.fromEntries(Object.entries(environmentVariables()));
    return await processes.run([BINARY, ...argv], {
        cwd,
        env: { ...environment, NO_COLOR: '1', CI: '1', PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) },
        timeoutMs: PLANTED_TIMEOUT_MS,
    });
}

test.each([
    ['source.toml', 'value = """\n# gspot-ignore structure/folder-names\n"""'],
    ['source.rb', 'value = <<TEXT\n# gspot-ignore structure/folder-names\nTEXT'],
])('the compiled binary distinguishes literal and active suppressions in %s', async (path, literal) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nrequire_reasons = true\nkits = ["structure"]\n',
        [path]: `${literal}\n# gspot-ignore structure/folder-names\nactual = 1\n`,
    });
    const checked = await binary(sandbox.path, ['check', '--only', 'integrity/suppressions', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(checked.stdout));
    expect(report.checks.map(({ status }) => status)).toStrictEqual(['fail']);
    expect(
        report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([{ file: path, line: 4, rule: 'gspot-ignore-no-reason' }]);
});

describe('the compiled binary', () => {
    test(
        'prints the package version, installs from its embedded assets and checks a planted script',
        async () => {
            expect(existsSync(BINARY)).toBe(true);
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
            commitAll(sandbox.path);
            const ran = await binary(sandbox.path, ['--version']);
            expect(ran.stdout.trim()).toBe(GSPOT_VERSION);
            const init = await binary(sandbox.path, [
                'init',
                '--yes',
                '--kits',
                'bash',
                '--no-runner',
                '--no-ci',
                '--no-install',
            ]);
            expect(init.code).toBe(0);
            expect(existsSync(join(sandbox.path, '.gspot', 'rules', 'general', 'agent', 'WORKING.md'))).toBe(true);
            const checked = await binary(sandbox.path, ['check', '--only', 'bash/shellcheck']);
            expect(checked.code).toBe(0);
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
    for (const path of BUILD_CHECKOUT_PATHS) {
        const destination = join(checkout, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(root, path), destination, {
            recursive: true,
            filter: (source) =>
                !source.split(/[\\/]/u).some((part) => ['node_modules', '.build', 'dist'].includes(part)),
        });
    }
    const options = { cwd: checkout, timeoutMs: 180_000 };
    const installed = await processes.run(
        [process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts'],
        options,
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const built = await processes.run([process.execPath, 'packages/cli/scripts/command.ts'], options);
    expect(built.code, built.stdout + built.stderr).toBe(0);
    const executable = join(sandbox.path, 'gspot');
    copyFileSync(join(checkout, 'dist', host.binary), executable);
    rmSync(checkout, { recursive: true });
    const consumer = join(sandbox.path, 'consumer');
    mkdirSync(consumer);
    writeFileSync(join(consumer, '.editorconfig'), 'root = true\n[*]\nindent_size = 2\n');
    const consumerOptions = {
        cwd: consumer,
        timeoutMs: 60_000,
        env: { NODE_PATH: undefined, NODE_OPTIONS: undefined },
    };
    const initialized = await processes.run([executable, ...EMBEDDED_INIT_ARGS], consumerOptions);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
    expect(existsSync(checkout)).toBe(false);
    await createFileTree(consumer, {
        ...EMBEDDED_PARSER_SOURCES,
        'gspot.toml':
            'version = 1\nlevel = "all"\nkits = ["bash", "python", "swift", "javascript", "typescript", "sql", "naming"]\n',
    });
    const checked = await processes.run(
        [executable, 'check', '--only', 'naming/identifiers', '--json'],
        consumerOptions,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as { checks: { status: string; findings: { file: string }[] }[] };
    expect(report.checks.map((check) => check.status)).toStrictEqual(['fail']);
    expect(
        [...new Set(report.checks.flatMap((check) => check.findings.map((finding) => finding.file)))].toSorted(
            (left, right) => left.localeCompare(right),
        ),
    ).toStrictEqual(Object.keys(EMBEDDED_PARSER_SOURCES).toSorted((left, right) => left.localeCompare(right)));
}, 360_000);
