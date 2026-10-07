import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { installCommand } from '#cli/commands/install.ts';
import { installToolProject } from '#cli/tools/project.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { packageToolProject } from '#cli/tools/npm/project.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { chmodSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';

/** The refused native install must preserve both its diagnostic and the absent published tree. */
async function expectInstallationRefusal(root: string, tools: ToolPin[], message: string): Promise<void> {
    using log = openOwnership(root);
    const staged: string[] = [];
    expect(
        await rejection(
            installToolProject(
                packageToolProject,
                {
                    read: log.files.read.bind(log.files),
                    installTree: (_kind, directory) => {
                        staged.push(directory);
                    },
                },
                { root, tools },
            ),
        ),
    ).toContain(message);
    expect(staged).toStrictEqual([]);
}

test.each([PACKAGE_PROJECTS[0]])(
    '%s from %s with %s refuses lifecycle scripts before contacting the registry',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, registry, tools } = fixture;
        const manifestPath = join(root, '.gspot/package.json');
        const manifest = readFileSync(manifestPath);
        chmodSync(manifestPath, 0o644);
        const hasScript = JSON.stringify({
            ...JSON.parse(manifest.toString('utf8')),
            scripts: { postinstall: 'exit 42' },
        });
        writeFileSync(manifestPath, hasScript);
        const requestsBefore = registry.requests;
        await expectInstallationRefusal(root, tools, 'scripts');
        expect(registry.requests).toBe(requestsBefore);
        expect(readFileSync(manifestPath, 'utf8')).toBe(hasScript);
        writeFileSync(manifestPath, manifest);
        chmodSync(manifestPath, 0o444);
    },
);
test('native wrapper download failure preserves the lockfile and publishes no partial installation', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'none');
    const { root, tools } = fixture;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const { lockfilePath, lockfile } = readPackageInputs(root, 'npm');
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
        await expectInstallationRefusal(root, tools, 'Native wrapper download failed');
        expect(readFileSync(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
            prettierManifest.version,
        );
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
    } finally {
        initialize.mockRestore();
    }
});

test('a reinstall the registry answers with 404 keeps the working tools and leaves no scratch folder', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const { root, registry, tools } = fixture;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const prettier = join(root, '.gspot/node_modules/prettier/bin/prettier.cjs');
    const { lockfilePath, lockfile } = readPackageInputs(root, 'npm');
    // The changed pin names a tarball the registry does not have, under an integrity no cache holds.
    const missing = createHash('sha512').update('missing tarball').digest('base64');
    const changed = lockfile
        .toString('utf8')
        .replace(
            `${registry.url}/prettier/-/prettier-${prettierManifest.version}.tgz`,
            `${registry.url}/prettier/-/prettier-missing.tgz`,
        )
        .replace(/"integrity": "sha512-[^"]+"/u, `"integrity": "sha512-${missing}"`);
    chmodSync(lockfilePath, 0o644);
    writeFileSync(lockfilePath, changed);
    chmodSync(lockfilePath, 0o444);
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'));
    await expectInstallationRefusal(root, tools, 'immutable installation failed');
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith('gspot-install-'))).toStrictEqual(before);
    const version = await runTestCommand([process.execPath, prettier, '--version'], { cwd: root });
    expect(version.stdout.trim()).toBe(prettierManifest.version);
});

test('a tool project file that changes during the install is refused and nothing is installed', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const { root, tools } = fixture;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
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
    await expectInstallationRefusal(root, tools, 'changed during installation');
    expect(installing).toHaveBeenCalled();
    expect(readFileSync(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
        prettierManifest.version,
    );
});
