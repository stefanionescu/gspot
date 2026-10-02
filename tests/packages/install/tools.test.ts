// Installs built packages from an isolated registry: private tool installation preserves authored metadata, and the
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { join, relative, delimiter } from 'node:path';
import { RELEASE_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { environment } from '#tests/harness/package/packages.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { createConsumer } from '#tests/harness/package/consumer.ts';
import { getPublishedRelease } from '#tests/harness/package/published.ts';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import type { PublishedRelease, InstalledConsumer } from '#tests/types/package.ts';

const FORMATTER_INIT = [
    'init',
    '--json',
    '--yes',
    '--kits',
    'format',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];

/** Prepares authored package data and private formatter inputs beneath an outdated host runner. */
async function prepareFormatterConsumer(
    installation: InstalledConsumer,
    release: PublishedRelease,
): Promise<{
    toolConsumer: string;
    toolOptions: {
        cwd: string;
        timeoutMs: number;
        env: Record<string, string | undefined>;
    };
    authoredPackage: string;
}> {
    const { command } = installation;
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    const hostTools = join(installation.workspace, 'host-tools');
    mkdirSync(toolConsumer);
    mkdirSync(hostTools);
    writeFileSync(join(hostTools, 'mise'), '#!/bin/sh\nprintf "2026.5.15\\n"\n', { mode: 0o755 });
    const bun = await run(['bun', '--version'], {
        cwd: toolConsumer,
        env: environment,
        timeoutMs: RELEASE_TIMEOUT_MS,
    });
    if (bun.code !== 0) throw new Error(`Bun fixture version failed: ${bun.stdout}${bun.stderr}`);
    const authoredPackage = JSON.stringify({
        private: true,
        packageManager: `bun@${bun.stdout.trim()}`,
        scripts: { test: 'authored-command' },
    });
    writeFileSync(join(toolConsumer, 'package.json'), authoredPackage);
    writeFileSync(join(toolConsumer, '.npmrc'), `registry=${release.registry.url}\n`);
    writeFileSync(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
    // A mise file makes mise the runner init takes.
    writeFileSync(join(toolConsumer, 'mise.toml'), '');
    const toolOptions = {
        cwd: toolConsumer,
        timeoutMs: RELEASE_TIMEOUT_MS,
        env: {
            ...environment,
            CI: '1',
            NO_COLOR: '1',
            PATH: `${hostTools}${delimiter}${environment['PATH'] ?? ''}`,
            NPM_CONFIG_USERCONFIG: release.toolNpmrc,
            HTTP_PROXY: undefined,
            HTTPS_PROXY: undefined,
            ALL_PROXY: undefined,
            http_proxy: undefined,
            https_proxy: undefined,
            all_proxy: undefined,
            NO_PROXY: '127.0.0.1,localhost',
        },
    };
    const toolInit = await run([...command, ...FORMATTER_INIT], toolOptions);
    if (toolInit.code !== 0) throw new Error(`Formatter fixture init failed: ${toolInit.stdout}${toolInit.stderr}`);
    const selectedFormatter = await run([...command, 'set', 'enable', 'format/prettier'], toolOptions);
    if (selectedFormatter.code !== 0)
        throw new Error(`Formatter fixture selection failed: ${selectedFormatter.stdout}${selectedFormatter.stderr}`);
    return { toolConsumer, toolOptions, authoredPackage };
}

/** Initializes and installs the native checks through the published CLI. */
async function prepareNativeConsumer(installation: InstalledConsumer): Promise<{
    nativeConsumer: string;
    nativeOptions: { cwd: string; env: Record<string, string | undefined>; timeoutMs: number };
    authoredPackage: string;
}> {
    const authoredPackage = JSON.stringify({ private: true, scripts: { test: 'authored-command' } });
    const nativeConsumer = join(installation.workspace, 'wrapper-consumer');
    mkdirSync(nativeConsumer);
    writeFileSync(join(nativeConsumer, 'package.json'), authoredPackage);
    writeFileSync(join(nativeConsumer, 'settings.toml'), 'a    =    1\n');
    writeFileSync(join(nativeConsumer, 'notes.json'), '"text"   ');
    const nativeOptions = { ...installation.setupOptions, cwd: nativeConsumer };
    const nativeInit = await run(
        [
            ...installation.command,
            'init',
            '--yes',
            '--kits',
            'files',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
            '--json',
        ],
        nativeOptions,
    );
    if (nativeInit.code !== 0)
        throw new Error(`Native wrapper fixture failed: ${nativeInit.stdout}${nativeInit.stderr}`);
    const nativeLevel = await run([...installation.command, 'set', 'level', 'all', '--json'], nativeOptions);
    if (nativeLevel.code !== 0)
        throw new Error(`Native wrapper fixture failed: ${nativeLevel.stdout}${nativeLevel.stderr}`);
    const nativeInstall = await run([...installation.command, 'install', '--json'], nativeOptions);
    if (nativeInstall.code !== 0)
        throw new Error(`Native wrapper fixture failed: ${nativeInstall.stdout}${nativeInstall.stderr}`);
    return { nativeConsumer, nativeOptions, authoredPackage };
}

const release = getPublishedRelease();

// A check reports its finding through the tool gspot installed, an npm wrapper in the private tool folder or a native
// release, then passes on the corrected or fixed file.
async function expectInstalledCheck(
    command: string[],
    consumer: string,
    options: Parameters<typeof run>[1],
    check: {
        only: string;
        path: string;
        isNpm: boolean;
        defect?: string;
        corrected?: string;
        finding: Record<string, unknown>;
    },
): Promise<void> {
    const args = [...command, 'check', check.path, '--only', check.only, '--json'];
    if (check.defect !== undefined) writeFileSync(join(consumer, check.path), check.defect);
    const failed = await run(args, options);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const [checked] = (JSON.parse(failed.stdout) as RunReport).checks;
    expect(checked).toMatchObject({
        check: check.only,
        status: 'failed',
        findings: [{ file: check.path, ...check.finding }],
    });
    const executable = toPosix(relative(realpathSync(consumer), checked!.command![0]!));
    expect(executable.startsWith('.gspot/node_modules/')).toBe(check.isNpm);
    if (check.corrected === undefined) {
        const fixed = await run([...args, '--fix'], options);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    } else writeFileSync(join(consumer, check.path), check.corrected);
    const passed = await run(args, options);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
}

test(
    'private installation keeps authored and locked metadata, and the installed formatter fixes source',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(fixture, release);
        const toolManifest = readFileSync(join(toolConsumer, '.gspot/package.json'));
        const toolLock = readFileSync(join(toolConsumer, '.gspot/bun.lock'));
        expect(toolLock.toString('utf8')).not.toContain(release.registry.url);
        expect(toolLock.toString('utf8')).not.toContain(release.registry.work);
        const preview = await run([...command, 'install', '--dry-run', '--json'], toolOptions);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InstallJson).isDryRun).toBe(true);
        // The planted mise is older than the runner pin, so install exits 2 after it installs the npm tools.
        const installed = await run([...command, 'install', '--json'], toolOptions);
        expect(installed.code, installed.stdout + installed.stderr).toBe(2);
        expect(readFileSync(join(toolConsumer, '.gspot/package.json'))).toStrictEqual(toolManifest);
        expect(readFileSync(join(toolConsumer, '.gspot/bun.lock'))).toStrictEqual(toolLock);
        const formatter = [...command, 'check', 'source.js', '--only', 'format/prettier', '--json'];
        const invalid = await run(formatter, toolOptions);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
            { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
        ]);
        const fixed = await run([...formatter, '--fix'], toolOptions);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        const valid = await run(formatter, toolOptions);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed native tools report TOML and whitespace defects and accept corrections',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(fixture);
        await expectInstalledCheck(command, nativeConsumer, nativeOptions, {
            only: 'files/taplo-format',
            path: 'settings.toml',
            isNpm: false,
            finding: { fixable: true },
        });
        expect(readFileSync(join(nativeConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        await expectInstalledCheck(command, nativeConsumer, nativeOptions, {
            only: 'files/taplo',
            path: 'settings.toml',
            isNpm: false,
            defect: 'a = [\n',
            corrected: 'a = 1\n',
            finding: { line: 2, column: 1, fixable: false },
        });
        await expectInstalledCheck(command, nativeConsumer, nativeOptions, {
            only: 'format/editorconfig-checker',
            path: 'notes.json',
            isNpm: true,
            corrected: '"text"\n',
            finding: { line: 1, fixable: false },
        });
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);
