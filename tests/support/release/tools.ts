// Installs built packages from an isolated registry: private tool installation preserves authored metadata and native wrappers run.
import { join, delimiter } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { RELEASE_TIMEOUT_MS } from '#tests/config/release.ts';
import { environment } from '#tests/support/release/packages.ts';
import { runProcess as run } from '#tests/support/cli/command.ts';
import type { PublishedRelease, InstalledConsumer } from '#tests/types/release.ts';
import type { PrepareNativeConsumerResult, PrepareFormatterConsumerResult } from '#tests/types/results.ts';

const FORMATTER_INIT = [
    'init',
    '--json',
    '--yes',
    '--kits',
    'formatting',
    '--runner',
    'mise',
    '--no-ci',
    '--no-hooks',
    '--no-guides',
    '--no-install',
];

/** Prepares authored package data and private formatter inputs beneath an outdated host runner. */
export async function prepareFormatterConsumer(
    installation: InstalledConsumer,
    release: PublishedRelease,
): Promise<PrepareFormatterConsumerResult> {
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
    const selectedFormatter = await run([...command, 'set', 'extra_checks', 'formatting/prettier'], toolOptions);
    if (selectedFormatter.code !== 0)
        throw new Error(`Formatter fixture selection failed: ${selectedFormatter.stdout}${selectedFormatter.stderr}`);
    return { toolConsumer, toolOptions, authoredPackage };
}

/** Initializes and installs native check wrappers through the published CLI. */
export async function prepareNativeConsumer(installation: InstalledConsumer): Promise<PrepareNativeConsumerResult> {
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
            'configs',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-guides',
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
