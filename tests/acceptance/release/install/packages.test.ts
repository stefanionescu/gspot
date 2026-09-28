// Package publication and installation retain target completeness, version identity, and legal payloads.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import type { PublishedManifest } from '#tests/types/release.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/constants/release.ts';
import { runProcess as run } from '#tests/support/cli/command.ts';
import { createConsumer } from '#tests/support/release/consumer.ts';
import { rmSync, lstatSync, copyFileSync, readFileSync } from 'node:fs';
import { getPublishedRelease } from '#tests/support/release/published.ts';
import { publishTo, startRegistry } from '#tests/support/registry/lifecycle.ts';
import { host, root, environment, preparePackages } from '#tests/support/release/packages.ts';

test(
    'publication refuses a missing target before upload and accepts the restored target',
    async () => {
        const registry = await startRegistry();
        try {
            const built = await run([join(root, 'dist', host.binary), '--version'], {
                cwd: registry.work,
                env: environment,
                timeoutMs: RELEASE_TIMEOUT_MS,
            });
            expect(built.code, built.stdout + built.stderr).toBe(0);
            const version = built.stdout.trim();
            const [launcherPackage = '', ...labels] = version.split(/[-+]/u);
            expect(launcherPackage).toMatch(/^\d+\.\d+\.\d+$/u);
            expect(labels.every((label) => /^[0-9A-Za-z.-]+$/u.test(label))).toBe(true);
            const checkout = preparePackages(registry.work);
            const missing = join(checkout, 'dist', 'gspot-linux-arm64-musl');
            rmSync(missing);
            const refused = await publishTo(registry, version, checkout);
            expect(refused.code).not.toBe(0);
            const absent = await fetch(`${registry.url}/gspot`);
            expect(absent.status).toBe(404);
            await absent.arrayBuffer();
            copyFileSync(join(root, 'dist', 'gspot-linux-arm64-musl'), missing);
            const corrected = await publishTo(registry, version, checkout);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        } finally {
            await registry.stop();
        }
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed launcher and native packages contain matching versions and complete legal payloads',
    async () => {
        const release = getPublishedRelease();
        const { version } = release;
        await using installation = await createConsumer(release.registry, version);
        const { installed, consumer } = installation;
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
    },
    RELEASE_TIMEOUT_MS,
);
