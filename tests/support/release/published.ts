// The built packages published into an isolated registry, and a fresh consumer that installed them from it.
import prettier from 'prettier';
import { expect } from 'bun:test';
import { dirname, join } from 'node:path';
import { runProcess as run } from '#tests/support/cli/command.ts';
import { createConsumer } from '#tests/support/release/consumer.ts';
import { publishTo, startRegistry } from '#tests/support/registry/lifecycle.ts';
import { copyFileSync, existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import {
    RELEASE_TIMEOUT_MS,
    environment,
    host,
    preparePackages,
    requireCli,
    root,
} from '#tests/support/release/packages.ts';

/** The registry holding the published release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: Awaited<ReturnType<typeof startRegistry>>;
    version: string;
    toolNpmrc: string;
};

/** A consumer that installed the release, with the command that runs it. */
export type InstalledConsumer = Awaited<ReturnType<typeof createConsumer>>;

/**
 * Starts a registry, refuses a publish with a missing binary, then publishes the built packages and their dependency.
 * @returns the registry, the published version, and the tool npmrc
 */
export async function publishRelease(): Promise<PublishedRelease> {
    const registry = await startRegistry();
    const built = await run([join(root, 'dist', host.binary), '--version'], {
        cwd: registry.work,
        env: environment,
        timeoutMs: RELEASE_TIMEOUT_MS,
    });
    expect(built.code, built.stdout + built.stderr).toBe(0);
    const version = built.stdout.trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u);
    const checkout = preparePackages(registry.work);
    const missing = join(checkout, 'dist', 'gspot-linux-arm64-musl');
    rmSync(missing);
    const refused = publishTo(registry, version, checkout);
    expect(refused.code).not.toBe(0);
    const absent = await fetch(`${registry.url}/gspot`);
    expect(absent.status).toBe(404);
    await absent.arrayBuffer();
    copyFileSync(join(root, 'dist', 'gspot-linux-arm64-musl'), missing);
    const dependency = await run(
        [
            'npm',
            'publish',
            dirname(requireCli.resolve('detect-libc/package.json')),
            '--registry',
            registry.url,
            '--userconfig',
            registry.npmrc,
            '--ignore-scripts',
        ],
        { cwd: registry.work, env: environment, timeoutMs: RELEASE_TIMEOUT_MS },
    );
    expect(dependency.code, dependency.stdout + dependency.stderr).toBe(0);
    const published = publishTo(registry, version, checkout);
    expect(published.code, published.stdout + published.stderr).toBe(0);
    const toolNpmrc = join(registry.work, 'tools.npmrc');
    writeFileSync(
        toolNpmrc,
        `@gspot:registry=${registry.url}\n${registry.url.replace('http:', '')}/:_authToken=fake\n`,
        { mode: 0o600 },
    );
    return { registry, version, toolNpmrc };
}

/**
 * Installs the release into a fresh consumer and checks the installed packages.
 * @param release the published release
 * @returns the consumer fixture
 */
export async function installedConsumer(release: PublishedRelease): Promise<InstalledConsumer> {
    const { registry, version } = release;
    const fixture = await createConsumer(registry, version);
    const { installed, consumer } = fixture;
    try {
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const launcherDirectory = join(consumer, 'node_modules', 'gspot');
        const platformName = host.package;
        const platformDirectory = join(consumer, 'node_modules', platformName);
        expect(lstatSync(launcherDirectory).isSymbolicLink()).toBe(false);
        expect(lstatSync(platformDirectory).isSymbolicLink()).toBe(false);
        const launcher = (await Bun.file(join(launcherDirectory, 'package.json')).json()) as PublishedManifest;
        const platform = (await Bun.file(join(platformDirectory, 'package.json')).json()) as PublishedManifest;
        expect(launcher.version).toBe(version);
        expect(launcher.optionalDependencies?.[platformName]).toBe(version);
        expect(platform.version).toBe(version);
        for (const directory of [launcherDirectory, platformDirectory]) {
            expect(readFileSync(join(directory, 'LICENSE.md'), 'utf8')).toBe(
                readFileSync(join(root, 'LICENSE.md'), 'utf8'),
            );
        }
        expect(readFileSync(join(platformDirectory, 'NOTICE.md'), 'utf8')).toBe(
            readFileSync(join(root, 'dist/NOTICE.md'), 'utf8'),
        );
        return fixture;
    } catch (error) {
        await fixture[Symbol.asyncDispose]();
        throw error;
    }
}

/**
 * Initializes the consumer with several configurations and installs its private tools.
 * @param release the published release
 * @param fixture the installed consumer
 */
export async function initializeConsumer(release: PublishedRelease, fixture: InstalledConsumer): Promise<void> {
    const { registry, toolNpmrc } = release;
    const { command, setupOptions, consumer } = fixture;
    const initialized = await run(
        [
            ...command,
            'init',
            '--json',
            '--yes',
            '--configurations',
            'bash',
            'naming',
            'prose',
            'python',
            'swift',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-install',
        ],
        setupOptions,
    );
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installedTools = await run([...command, 'install', '--json'], {
        ...setupOptions,
        env: {
            ...setupOptions.env,
            NPM_CONFIG_USERCONFIG: toolNpmrc,
            BUN_INSTALL_CACHE_DIR: join(registry.work, 'tool-cache'),
        },
        timeoutMs: RELEASE_TIMEOUT_MS,
    });
    expect(installedTools.code, installedTools.stdout + installedTools.stderr).toBe(0);
    expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
    expect(existsSync(join(consumer, 'prettier.config.mjs'))).toBe(false);
    expect(() => {
        JSON.parse(initialized.stdout);
    }).not.toThrow();
    expect(initialized.stdout).not.toContain('formatter stdout');
    const filepath = join(consumer, 'source.js');
    const carried = await prettier.resolveConfig(filepath, {
        config: join(consumer, '.gspot/config/prettier.json'),
        editorconfig: true,
        useCache: false,
    });
    expect(await prettier.format(readFileSync(filepath, 'utf8'), { ...carried, filepath })).toBe(
        'const greeting = "hello"\n',
    );
    const futureJson = await prettier.resolveConfig(join(consumer, 'nested/future.json'), {
        config: join(consumer, '.gspot/config/prettier.json'),
        editorconfig: true,
        useCache: false,
    });
    expect(futureJson?.tabWidth).toBe(4);
    expect(existsSync(join(consumer, '.gspot', 'reports', 'report.json'))).toBe(false);
}

type PublishedManifest = { version: string; optionalDependencies?: Record<string, string> };
