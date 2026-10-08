import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { rootView } from '#cli/policy/settings/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { applyPlan, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { VALE_PACKAGES, VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { hasValePackages, installValePackages } from '#cli/lifecycle/install/contracts.ts';
import { INSTALLED, ENCODED_ARCHIVE } from '#tests/config/tools/configurations/general/prose/packages.ts';
import { installTree, readInstalledTree, deleteInstallation } from '#cli/lifecycle/ownership/state/public.ts';

// Acquires the same native packages through the locked owner for all four installation controls.
async function installPackages(root: string): Promise<string | undefined> {
    const session = await openSession(root);
    using log = openOwnership(root);
    return await installValePackages({
        search: session,
        owner: {
            read: (path) => log.files.read(path),
            installTree: (kind, output) => {
                installTree(log, kind, readInstalledTree(output, kind));
            },
        },
        level: session.policyFiles.policy.level,
        tool: toolPin(session.manifests.values(), 'vale'),
        timeoutSeconds: Number(rootView(session.scopes).settings['tool_timeout_seconds']),
    });
}

async function expectPublishedRules(root: string): Promise<void> {
    await using clone = await testdir();
    await createFileTree(clone.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'all' }),
        '.gspot/config/vale.ini': await readFile(join(root, '.gspot/config/vale.ini'), 'utf8'),
        'staged/Google/terms.yml': 'cloned bytes\n',
    });
    {
        using log = openOwnership(clone.path);
        installTree(log, 'vale', readInstalledTree(join(clone.path, 'staged'), 'vale'));
    }
    expect(await installPackages(clone.path)).toBeUndefined();
    expect(await readFile(join(clone.path, INSTALLED))).toStrictEqual(await readFile(join(root, INSTALLED)));
}

async function expectPrunedRules(root: string): Promise<void> {
    await createFileTree(root, { '.gspot/vale/Retired/terms.yml': 'old rule\n' });
    expect(await installPackages(root)).toBeUndefined();
    expect(await pathExists(join(root, '.gspot/vale/Retired'))).toBe(false);
    expect(await pathExists(join(root, INSTALLED))).toBe(true);
    const configuration = await readFile(join(root, '.gspot/config/vale.ini'));
    {
        using log = openOwnership(root);
        deleteInstallation(log, 'vale');
    }
    expect(await readFile(join(root, '.gspot/config/vale.ini'))).toStrictEqual(configuration);
    expect(await pathExists(join(root, '.gspot/vale/Google'))).toBe(false);
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

async function expectEditedRules(root: string): Promise<void> {
    const installed = await readFile(join(root, INSTALLED));
    await chmod(join(root, INSTALLED), 0o644);
    await writeFile(join(root, INSTALLED), 'edited\n');
    expect(await installPackages(root)).toBeUndefined();
    expect(await readFile(join(root, INSTALLED))).toStrictEqual(installed);
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

test.each([
    { name: 'replaces cloned bytes with the published package', verify: expectPublishedRules },
    { name: 'deletes a package no longer shipped', verify: expectPrunedRules },
    { name: 'replaces an edited package and leaves authored files', verify: expectEditedRules },
])('Vale package installation $name', async ({ verify }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['prose'], { level: 'all' }),
        'authored.txt': 'keep\n',
        '.gspot/config/vale/styles/Google/legacy.yml': 'authored legacy bytes\n',
    });
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch: () => new Response(Buffer.from(ENCODED_ARCHIVE, 'base64')),
    });
    try {
        const packages = VALE_PACKAGES.map((name) => `http://127.0.0.1:${String(server.port)}/${name}.zip`).join(', ');
        {
            using log = openOwnership(directory.path);

            applyPlan(
                log,
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
            );
        }
        expect(await installPackages(directory.path)).toBeUndefined();
        expect(hasValePackages(directory.path, 'all')).toBe(true);
        for (const folder of VALE_PACKAGE_FOLDERS)
            expect(await pathExists(join(directory.path, '.gspot/vale', folder))).toBe(true);
        await verify(directory.path);
        expect(await readFile(join(directory.path, '.gspot/config/vale/styles/Google/legacy.yml'), 'utf8')).toBe(
            'authored legacy bytes\n',
        );
    } finally {
        await server.stop(true);
    }
});
