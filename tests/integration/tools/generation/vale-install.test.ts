import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { kitManifests } from '#cli/kits/manifests.ts';
import { parseAlerts } from '#cli/checks/prose/vale.ts';
import { containing } from '#tests/support/expectations.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { openOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { hasPackages, removePackages, installPackages } from '#cli/tools/vale.ts';

// A Zip archive containing LocalStyle/terms.yml, an existence rule rejecting ambiguousword.
const PACKAGE = Buffer.from(
    'UEsDBBQAAAAAAAAAIQC8KoVlUQAAAFEAAAAUAAAATG9jYWxTdHlsZS90ZXJtcy55bWxleHRlbmRzOiBleGlzdGVuY2UKbWVzc2FnZTogIkF2b2lkICclcycuIgpsZXZlbDogZXJyb3IKdG9rZW5zOgogIC0gYW1iaWd1b3Vzd29yZApQSwECFAMUAAAAAAAAACEAvCqFZVEAAABRAAAAFAAAAAAAAAAAAAAApAEAAAAATG9jYWxTdHlsZS90ZXJtcy55bWxQSwUGAAAAAAEAAQBCAAAAgwAAAAAA',
    'base64',
);

const INSTALLED = '.gspot/config/vale/styles/LocalStyle/terms.yml';

async function expectPublishedRules(root: string): Promise<void> {
    await using clone = await testdir();
    await createFileTree(clone.path, {
        '.gspot/config/vale.ini': readFileSync(join(root, '.gspot/config/vale.ini'), 'utf8'),
        [INSTALLED]: 'cloned bytes\n',
    });
    expect(await installPackages(clone.path)).toBeUndefined();
    expect(readFileSync(join(clone.path, INSTALLED))).toStrictEqual(readFileSync(join(root, INSTALLED)));
    const command = ['vale', '--config', '.gspot/config/vale.ini', '--output', 'JSON', '--no-exit', 'guide.md'];
    const checked = await run(command, { cwd: root });
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(parseAlerts(checked.stdout)).toStrictEqual([
        containing({
            file: 'guide.md',
            line: 1,
            check: 'LocalStyle.terms',
            message: "Avoid 'ambiguousword'.",
        }),
    ]);
    writeFileSync(join(root, 'guide.md'), 'Clear writing.\n');
    const corrected = await run(command, { cwd: root });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(parseAlerts(corrected.stdout)).toStrictEqual([]);
}

async function expectPrunedRules(root: string): Promise<void> {
    await createFileTree(root, { '.gspot/config/vale/styles/Retired/terms.yml': 'old rule\n' });
    expect(await installPackages(root)).toBeUndefined();
    expect(existsSync(join(root, '.gspot/config/vale/styles/Retired'))).toBe(false);
    expect(existsSync(join(root, INSTALLED))).toBe(true);
    removePackages(root);
    expect(existsSync(join(root, '.gspot/config/vale/styles/LocalStyle'))).toBe(false);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

async function expectEditedRules(root: string): Promise<void> {
    const synced = readFileSync(join(root, INSTALLED));
    chmodSync(join(root, INSTALLED), 0o644);
    writeFileSync(join(root, INSTALLED), 'edited\n');
    expect(await installPackages(root)).toBeUndefined();
    expect(readFileSync(join(root, INSTALLED))).toStrictEqual(synced);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

test.each([
    { name: 'replaces cloned bytes and checks corrections', verify: expectPublishedRules },
    { name: 'deletes a package the configuration no longer names', verify: expectPrunedRules },
    { name: 'replaces an edited package and leaves authored files', verify: expectEditedRules },
])(
    'pinned Vale $name',
    async ({ verify }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'guide.md': 'An ambiguousword.\n', 'authored.txt': 'keep\n' });
        const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(PACKAGE) });
        try {
            const pin = kitManifests()
                .get('prose')!
                .tools.find((tool) => tool.name === 'vale')!.version!;
            const version = await run(['vale', '--version'], { cwd: directory.path });
            expect(version.code, version.stdout + version.stderr).toBe(0);
            expect(version.stdout).toContain(pin);
            const owner = openOwner(directory.path);
            try {
                owner.replace(
                    '.gspot/config/vale.ini',
                    {
                        bytes: Buffer.from(
                            `StylesPath = vale/styles\nPackages = http://127.0.0.1:${String(server.port)}/LocalStyle.zip\n\n[*]\nBasedOnStyles = LocalStyle\n`,
                        ),
                        mode: 0o444,
                    },
                    'config',
                );
            } finally {
                owner.close();
            }
            expect(await installPackages(directory.path)).toBeUndefined();
            expect(hasPackages(directory.path)).toBe(true);
            expect(readOwnership(directory.path).files.map((file) => file.path)).toStrictEqual([
                '.gspot/config/vale.ini',
            ]);
            await verify(directory.path);
        } finally {
            await server.stop(true);
        }
    },
    60_000,
);
