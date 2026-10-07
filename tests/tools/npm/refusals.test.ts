import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { installPackageProject } from '#cli/tools/npm/project.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { chmodSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';

test.each([PACKAGE_PROJECTS[0]])(
    '%s from %s with %s refuses lifecycle scripts before contacting the registry',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, registry } = fixture;
        const { tools } = fixture;
        const { manifest } = readPackageInputs(root, installer);
        const manifestPath = join(root, '.gspot/package.json');
        chmodSync(manifestPath, 0o644);
        const hasScript = JSON.stringify({
            ...JSON.parse(manifest.toString('utf8')),
            scripts: { postinstall: 'exit 42' },
        });
        writeFileSync(manifestPath, hasScript);
        const requestsBefore = registry.requests;
        {
            using log = openOwnership(root);
            const staged: string[] = [];
            expect(
                await rejection(
                    installPackageProject(
                        root,
                        {
                            read: log.files.read.bind(log.files),
                            installTree: (_kind, directory) => {
                                staged.push(directory);
                            },
                        },
                        tools,
                    ),
                ),
            ).toContain('scripts');
            expect(staged).toStrictEqual([]);
        }
        expect(registry.requests).toBe(requestsBefore);
        expect(readFileSync(manifestPath, 'utf8')).toBe(hasScript);
        writeFileSync(manifestPath, manifest);
        chmodSync(manifestPath, 0o444);
    },
);
test('native wrapper download failure preserves the lock and publishes no partial installation', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'none');
    const { root } = fixture;
    const { tools } = fixture;
    const { lockPath, lock } = readPackageInputs(root, 'npm');
    const original = spawn.run;
    const initialize = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
        if (/(?:editorconfig-checker|[\\/]ec(?:\.cmd)?$)/u.test(argv[0] ?? ''))
            return {
                code: 7,
                stdout: '',
                stderr: 'Native wrapper download failed',
                missing: false,
                duration: 1,
            };
        return original(argv, options);
    });
    try {
        {
            using log = openOwnership(root);
            const staged: string[] = [];
            expect(
                await rejection(
                    installPackageProject(
                        root,
                        {
                            read: log.files.read.bind(log.files),
                            installTree: (_kind, directory) => {
                                staged.push(directory);
                            },
                        },
                        tools,
                    ),
                ),
            ).toContain('Native wrapper download failed');
            expect(staged).toStrictEqual([]);
        }
        expect(readFileSync(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
            prettierManifest.version,
        );
        expect(readFileSync(lockPath)).toStrictEqual(lock);
    } finally {
        initialize.mockRestore();
    }
});

test('a reinstall the registry answers with 404 keeps the working tools and leaves no scratch folder', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const { root, registry } = fixture;
    const { tools } = fixture;
    const prettier = join(root, '.gspot/node_modules/prettier/bin/prettier.cjs');
    const { lockPath, lock } = readPackageInputs(root, 'npm');
    // The changed pin names a tarball the registry does not have, under an integrity no cache holds.
    const missing = createHash('sha512').update('missing tarball').digest('base64');
    const changed = lock
        .toString('utf8')
        .replace(
            `${registry.url}/prettier/-/prettier-${prettierManifest.version}.tgz`,
            `${registry.url}/prettier/-/prettier-missing.tgz`,
        )
        .replace(/"integrity": "sha512-[^"]+"/u, `"integrity": "sha512-${missing}"`);
    chmodSync(lockPath, 0o644);
    writeFileSync(lockPath, changed);
    chmodSync(lockPath, 0o444);
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'));
    {
        using log = openOwnership(root);
        const staged: string[] = [];
        expect(
            await rejection(
                installPackageProject(
                    root,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, directory) => {
                            staged.push(directory);
                        },
                    },
                    tools,
                ),
            ),
        ).toContain('immutable installation failed');
        expect(staged).toStrictEqual([]);
    }
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'))).toStrictEqual(before);
    const version = await runTestCommand([process.execPath, prettier, '--version'], { cwd: root });
    expect(version.stdout.trim()).toBe(prettierManifest.version);
});

test('a tool project file that changes during the install is refused and nothing is installed', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const { root } = fixture;
    const { tools } = fixture;
    const manifestPath = join(root, '.gspot/package.json');
    const original = spawn.run;
    // Another writer edits the tool project while the package manager installs it.
    using installing = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
        const result = await original(argv, options);
        if (argv.includes('ci')) {
            chmodSync(manifestPath, 0o644);
            writeFileSync(manifestPath, `${readFileSync(manifestPath, 'utf8')}\n`);
        }
        return result;
    });
    {
        using log = openOwnership(root);
        const staged: string[] = [];
        expect(
            await rejection(
                installPackageProject(
                    root,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, directory) => {
                            staged.push(directory);
                        },
                    },
                    tools,
                ),
            ),
        ).toContain('changed during installation');
        expect(staged).toStrictEqual([]);
    }
    expect(installing).toHaveBeenCalled();
    expect(readFileSync(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
        prettierManifest.version,
    );
});
