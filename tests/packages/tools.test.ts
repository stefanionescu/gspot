// Installed tools preserve authored metadata and report defects before accepting their corrections.
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { join, relative, delimiter } from 'node:path';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runPackageCheck } from '#tests/harness/check-case.ts';
import { getPublishedRelease } from '#tests/harness/release.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { consumerEnvironment } from '#tests/harness/environment.ts';
import type { PublishedRelease } from '#automation/types/package.ts';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import type { PackageCheckCase } from '#tests/types/packages/check-case.ts';
import type { NativeConsumer, FormatterConsumer } from '#tests/types/packages/tools.ts';
import { OUTDATED_MISE, FORMATTER_INIT, SUPPORTED_MISE } from '#tests/config/packages/tools.ts';

/** Prepares authored package data and private formatter inputs with a fake mise, older than the runner pin, first on PATH. */
async function prepareFormatterConsumer(installation: Consumer, release: PublishedRelease): Promise<FormatterConsumer> {
    const { command } = installation;
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    const hostTools = join(installation.workspace, 'host-tools');
    await mkdir(toolConsumer);
    await mkdir(hostTools);
    await writeFile(join(hostTools, 'mise'), SUPPORTED_MISE, { mode: 0o755 });
    const bun = await runTestCommand(['bun', '--version'], {
        cwd: toolConsumer,
        env: consumerEnvironment,
    });
    if (bun.code !== 0) throw new Error(`Bun version failed: ${bun.stdout}${bun.stderr}`);
    const authoredPackage = JSON.stringify({
        private: true,
        packageManager: `bun@${bun.stdout.trim()}`,
        scripts: { test: 'authored-command' },
    });
    await writeFile(join(toolConsumer, 'package.json'), authoredPackage);
    await writeFile(join(toolConsumer, '.npmrc'), `@gspothq:registry=${release.registry.url}/\n`);
    await writeFile(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
    // A mise file makes mise the runner init takes.
    await writeFile(join(toolConsumer, 'mise.toml'), '');
    const toolOptions = {
        cwd: toolConsumer,
        env: {
            ...consumerEnvironment,
            CI: '1',
            NO_COLOR: '1',
            PATH: `${hostTools}${delimiter}${consumerEnvironment['PATH'] ?? ''}`,
            NPM_CONFIG_USERCONFIG: release.registry.npmrc,
            BUN_INSTALL_CACHE_DIR: join(installation.workspace, 'formatter-cache'),
            HTTP_PROXY: undefined,
            HTTPS_PROXY: undefined,
            ALL_PROXY: undefined,
            http_proxy: undefined,
            https_proxy: undefined,
            all_proxy: undefined,
            NO_PROXY: '127.0.0.1,localhost',
        },
    };
    const toolInit = await runTestCommand([...command, ...FORMATTER_INIT], toolOptions);
    if (toolInit.code !== 0) throw new Error(`Formatter sandbox init failed: ${toolInit.stdout}${toolInit.stderr}`);
    const selectedFormatter = await runTestCommand([...command, 'set', 'level', 'all'], toolOptions);
    if (selectedFormatter.code !== 0)
        throw new Error(`Formatter sandbox selection failed: ${selectedFormatter.stdout}${selectedFormatter.stderr}`);
    const installed = await runTestCommand([...command, 'install', '--json'], toolOptions);
    if (installed.code !== 0)
        throw new Error(`Formatter sandbox install failed: ${installed.stdout}${installed.stderr}`);
    await writeFile(join(hostTools, 'mise'), OUTDATED_MISE);
    return { toolConsumer, toolOptions, authoredPackage };
}

/** Initializes and installs the native checks through the published CLI. */
async function prepareNativeConsumer(installation: Consumer): Promise<NativeConsumer> {
    const authoredPackage = JSON.stringify({ private: true, scripts: { test: 'authored-command' } });
    const nativeConsumer = join(installation.workspace, 'native-consumer');
    await mkdir(nativeConsumer);
    await writeFile(join(nativeConsumer, 'package.json'), authoredPackage);
    await writeFile(join(nativeConsumer, 'settings.toml'), 'a    =    1\n');
    await writeFile(join(nativeConsumer, 'notes.json'), '"text"   ');
    const nativeOptions = { ...installation.onlineOptions, cwd: nativeConsumer };
    const nativeInit = await runTestCommand(
        [...installation.command, 'init', '--yes', '--configurations', 'files', ...QUIET_INIT, '--json'],
        nativeOptions,
    );
    if (nativeInit.code !== 0) throw new Error(`Native sandbox init failed: ${nativeInit.stdout}${nativeInit.stderr}`);
    const nativeLevel = await runTestCommand([...installation.command, 'set', 'level', 'all', '--json'], nativeOptions);
    if (nativeLevel.code !== 0)
        throw new Error(`Native sandbox level failed: ${nativeLevel.stdout}${nativeLevel.stderr}`);
    const nativeInstall = await runTestCommand([...installation.command, 'install', '--json'], nativeOptions);
    if (nativeInstall.code !== 0)
        throw new Error(`Native sandbox install failed: ${nativeInstall.stdout}${nativeInstall.stderr}`);
    return { nativeConsumer, nativeOptions, authoredPackage };
}

const release = getPublishedRelease();

test('private installation keeps authored and locked metadata, and the installed formatter fixes source', async () => {
    await using consumer = await createConsumer(release.registry, release.version);

    const { command } = consumer;
    const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(consumer, release);
    const firstInstall = await runTestCommand([...command, 'install', '--json'], toolOptions);
    expect(firstInstall.code, firstInstall.stdout + firstInstall.stderr).toBe(2);
    const toolManifest = await readFile(join(toolConsumer, '.gspot/package.json'));
    const toolLockfile = await readFile(join(toolConsumer, '.gspot/bun.lock'));
    expect(toolLockfile.toString('utf8')).not.toContain(release.registry.url);
    expect(toolLockfile.toString('utf8')).not.toContain(release.registry.work);
    const preview = await runTestCommand([...command, 'install', '--dry-run', '--json'], toolOptions);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect((JSON.parse(preview.stdout) as InstallJson).dryRun).toBe(true);
    // The old runner is refused; the completed installation and its metadata remain.
    const installed = await runTestCommand([...command, 'install', '--json'], toolOptions);
    expect(installed.code, installed.stdout + installed.stderr).toBe(2);
    expect(await readFile(join(toolConsumer, '.gspot/package.json'))).toStrictEqual(toolManifest);
    expect(await readFile(join(toolConsumer, '.gspot/bun.lock'))).toStrictEqual(toolLockfile);
    const formatter = [...command, 'check', 'source.js', '--only', 'format/prettier', '--json'];
    const invalid = await runTestCommand(formatter, toolOptions);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
    ]);
    const fixed = await runTestCommand([...formatter, '--fix'], toolOptions);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    const valid = await runTestCommand(formatter, toolOptions);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(await readFile(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
});

test('installed native tools report TOML and whitespace defects and accept corrections', async () => {
    await using consumer = await createConsumer(release.registry, release.version);

    const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(consumer);
    const checks = [
        {
            only: 'files/taplo-format',
            fix: true,
            path: 'settings.toml',
            isNpm: false,
            findings: [{ fixable: true }],
        },
        {
            only: 'files/taplo',
            path: 'settings.toml',
            isNpm: false,
            defect: 'a = [\n',
            corrected: 'a = 1\n',
            findings: [{ line: 2, column: 1, fixable: false }],
        },
        {
            only: 'format/editorconfig-checker',
            path: 'notes.json',
            isNpm: true,
            corrected: '"text"\n',
            findings: [
                { fixable: false, message: 'Wrong line endings or no final newline' },
                { line: 1, fixable: false, message: 'Trailing whitespace' },
            ],
        },
    ] satisfies PackageCheckCase[];
    for (const check of checks) {
        const { failed, fixed, passed } = await runPackageCheck(consumer, nativeOptions, check);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.skips).toStrictEqual([]);
        expect(failed.report.checks).toMatchObject([
            {
                check: check.only,
                status: 'failed',
                findings: check.findings.map((finding) => ({ file: check.path, ...finding })),
            },
        ]);
        const executable = toPosix(relative(await realpath(nativeOptions.cwd), failed.report.checks[0]!.command![0]!));
        expect(executable.startsWith('.gspot/node_modules/')).toBe(check.isNpm);
        if (check.only === 'files/taplo-format') {
            expect(fixed?.code, String(fixed?.stdout) + String(fixed?.stderr)).toBe(0);
            expect(await readFile(join(nativeConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        } else expect(fixed).toBeUndefined();
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.skips).toStrictEqual([]);
        expect(passed.report.checks).toMatchObject([{ check: check.only, status: 'passed', findings: [] }]);
    }
    expect(await readFile(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
});
