import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasValePackages } from '#cli/install/vale.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { pathExists, zipArchive } from '#tests/setup/files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { applyPlans, openWriter } from '#cli/ownership/writer.ts';
import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
import { createInstallationRegistry } from '#tests/setup/install.ts';
import { VALE_PACKAGES, VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { PROSE_SANDBOX, GOOGLE_TERMS_FILE, VALE_PACKAGE_FILES } from '#tests/config/prose.ts';

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test('gspot install restores deleted Vale dictionaries, and prose/vale passes again', async () => {
    const { root: sandbox, environment } = installedSandbox();
    await rm(join(sandbox, '.gspot', 'vale', 'config', 'dictionaries'), {
        recursive: true,
    });
    const broken = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
    expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([{ check: 'prose/vale', status: 'error' }]);
    // Install reacquires the missing dictionaries through the install command in the diagnostic.
    const installed = await spawnGspot(sandbox, ['install'], environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const corrected = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'prose/vale', status: 'passed', findings: [] },
    ]);
});
// Install the configured packages through the command a user runs.
async function installPackages(root: string): Promise<void> {
    await using registry = await createInstallationRegistry(root, runCommand);
    const installed = await spawnGspot(root, ['install'], registry.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
}

/** Build the readable package files as a stored Zip in the test's scratch folder. */
async function packageZip(root: string): Promise<Buffer> {
    const bytes = zipArchive(
        Object.entries(VALE_PACKAGE_FILES).map(([path, text]) => [path, Buffer.from(text)] as const),
    );
    await writeFile(join(root, 'packages.zip'), bytes);
    return bytes;
}

test('Vale package install deletes a package gspot no longer ships', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose'], { level: 'all' }),
        'authored.txt': 'keep\n',
        'guide.md': '# Guide\n',
        '.gspot/config/vale/styles/Google/legacy.yml': 'authored legacy bytes\n',
    });
    const archive = await packageZip(directory.path);
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: () => new Response(new Uint8Array(archive)),
    });
    try {
        const packages = VALE_PACKAGES.map((name) => `http://127.0.0.1:${String(server.port)}/${name}.zip`).join(', ');
        {
            using log = openWriter(directory.path);

            applyPlans(log, [
                planReplacement(log, {
                    path: '.gspot/config/vale.ini',
                    next: {
                        bytes: Buffer.from(
                            `StylesPath = ../vale\nPackages = ${packages}\n\n[*]\nBasedOnStyles = Google\n`,
                        ),
                        mode: 0o444,
                    },
                    kind: 'tool_file',
                }),
            ]);
        }
        await installPackages(directory.path);
        expect(hasValePackages(directory.path, 'all')).toBe(true);
        for (const folder of VALE_PACKAGE_FOLDERS)
            expect(await pathExists(join(directory.path, '.gspot/vale', folder))).toBe(true);

        await createFileTree(directory.path, { '.gspot/vale/Retired/terms.yml': 'old rule\n' });
        await installPackages(directory.path);
        expect(await pathExists(join(directory.path, '.gspot/vale/Retired'))).toBe(false);
        expect(await pathExists(join(directory.path, GOOGLE_TERMS_FILE))).toBe(true);
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep\n');
        expect(await readFile(join(directory.path, '.gspot/config/vale/styles/Google/legacy.yml'), 'utf8')).toBe(
            'authored legacy bytes\n',
        );
    } finally {
        await server.stop(true);
    }
});

test('Vale package install replaces an edited package and keeps your files', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose'], { level: 'all' }),
        'authored.txt': 'keep\n',
        'guide.md': '# Guide\n',
        '.gspot/config/vale/styles/Google/legacy.yml': 'authored legacy bytes\n',
    });
    const archive = await packageZip(directory.path);
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: () => new Response(new Uint8Array(archive)),
    });
    try {
        const packages = VALE_PACKAGES.map((name) => `http://127.0.0.1:${String(server.port)}/${name}.zip`).join(', ');
        {
            using log = openWriter(directory.path);

            applyPlans(log, [
                planReplacement(log, {
                    path: '.gspot/config/vale.ini',
                    next: {
                        bytes: Buffer.from(
                            `StylesPath = ../vale\nPackages = ${packages}\n\n[*]\nBasedOnStyles = Google\n`,
                        ),
                        mode: 0o444,
                    },
                    kind: 'tool_file',
                }),
            ]);
        }
        await installPackages(directory.path);
        expect(hasValePackages(directory.path, 'all')).toBe(true);
        for (const folder of VALE_PACKAGE_FOLDERS)
            expect(await pathExists(join(directory.path, '.gspot/vale', folder))).toBe(true);

        const installed = await readFile(join(directory.path, GOOGLE_TERMS_FILE));
        await chmod(join(directory.path, GOOGLE_TERMS_FILE), 0o644);
        await writeFile(join(directory.path, GOOGLE_TERMS_FILE), 'edited\n');
        await installPackages(directory.path);
        expect(await readFile(join(directory.path, GOOGLE_TERMS_FILE))).toStrictEqual(installed);
        expect(await readFile(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep\n');
        expect(await readFile(join(directory.path, '.gspot/config/vale/styles/Google/legacy.yml'), 'utf8')).toBe(
            'authored legacy bytes\n',
        );
    } finally {
        await server.stop(true);
    }
});
