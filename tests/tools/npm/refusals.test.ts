import { join } from 'node:path';
import { testdir } from 'testdirs';
import { createHash } from 'node:crypto';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { installCommand } from '#cli/commands/contracts.ts';
import { installToolProject } from '#cli/tools/contracts.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
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

test('npm from package.json with mise refuses lifecycle scripts before contacting the registry', async () => {
    await using sandbox = await createPackageProject(...PACKAGE_PROJECTS[0]);
    const { root, registry, tools } = sandbox;
    const manifestPath = join(root, '.gspot/package.json');
    const manifest = await readFile(manifestPath);
    await chmod(manifestPath, 0o644);
    const hasScript = JSON.stringify({
        ...JSON.parse(manifest.toString('utf8')),
        scripts: { postinstall: 'exit 42' },
    });
    await writeFile(manifestPath, hasScript);
    const requestsBefore = registry.requests;
    await expectInstallationRefusal(root, tools, 'scripts');
    expect(registry.requests).toBe(requestsBefore);
    expect(await readFile(manifestPath, 'utf8')).toBe(hasScript);
});
test('native wrapper download failure preserves the lockfile and publishes no partial installation', async () => {
    await using sandbox = await createPackageProject('npm', 'package.json', 'none');
    const { root, tools } = sandbox;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const { lockfilePath, lockfile } = await readPackageInputs(root, 'npm');
    const original = spawn.run;
    using _executableDownload = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
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
    await expectInstallationRefusal(root, tools, 'Native wrapper download failed');
    expect(await readFile(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
        prettierManifest.version,
    );
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
});

test('a reinstall the registry answers with 404 keeps the working tools and leaves no scratch folder', async () => {
    await using sandbox = await createPackageProject('npm', 'package.json', 'mise');
    const { root, registry, tools } = sandbox;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const prettier = join(root, '.gspot/node_modules/prettier/bin/prettier.cjs');
    const { lockfilePath, lockfile } = await readPackageInputs(root, 'npm');
    // The changed pin names a tarball the registry does not have, under an integrity no cache holds.
    const missing = createHash('sha512').update('missing tarball').digest('base64');
    const changed = lockfile
        .toString('utf8')
        .replace(
            `${registry.url}/prettier/-/prettier-${prettierManifest.version}.tgz`,
            `${registry.url}/prettier/-/prettier-missing.tgz`,
        )
        .replace(/"integrity": "sha512-[^"]+"/u, `"integrity": "sha512-${missing}"`);
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, changed);
    await chmod(lockfilePath, 0o444);
    await using temporary = await testdir();
    await using cache = await testdir();
    using _environment = useEnvironment({
        TMPDIR: temporary.path,
        TEMP: temporary.path,
        TMP: temporary.path,
        NODE_COMPILE_CACHE: cache.path,
    });
    await expectInstallationRefusal(root, tools, 'immutable installation failed');
    expect(await readdir(temporary.path)).toStrictEqual([]);
    const version = await runTestCommand([process.execPath, prettier, '--version'], { cwd: root });
    expect(version.stdout.trim()).toBe(prettierManifest.version);
});

test('a tool project file that changes during the install is refused and nothing is installed', async () => {
    await using sandbox = await createPackageProject('npm', 'package.json', 'mise');
    const { root, tools } = sandbox;
    const installed = await installCommand({ cwd: root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const manifestPath = join(root, '.gspot/package.json');
    const original = spawn.run;
    // Another writer edits the tool project while the package manager installs it.
    using _installing = spyOn(spawn, 'run').mockImplementation(async (argv, options) => {
        const result = await original(argv, options);
        if (argv.includes('ci')) {
            await chmod(manifestPath, 0o644);
            await writeFile(manifestPath, `${await readFile(manifestPath, 'utf8')}\n`);
        }
        return result;
    });
    await expectInstallationRefusal(root, tools, 'changed during installation');
    expect(await readFile(join(root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
        prettierManifest.version,
    );
});
