import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openOwner, getOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
    expect(await installPackages(clone.path, undefined)).toBeUndefined();
    expect(readFileSync(join(clone.path, INSTALLED))).toStrictEqual(readFileSync(join(root, INSTALLED)));
}

async function expectPrunedRules(root: string): Promise<void> {
    await createFileTree(root, { '.gspot/config/vale/styles/Retired/terms.yml': 'old rule\n' });
    expect(await installPackages(root, undefined)).toBeUndefined();
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
    expect(await installPackages(root, undefined)).toBeUndefined();
    expect(readFileSync(join(root, INSTALLED))).toStrictEqual(synced);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

test.each([
    { name: 'replaces cloned bytes with the published package', verify: expectPublishedRules },
    { name: 'deletes a package the configuration no longer names', verify: expectPrunedRules },
    { name: 'replaces an edited package and leaves authored files', verify: expectEditedRules },
])(
    'Vale package sync $name',
    async ({ verify }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'guide.md': 'An ambiguousword.\n', 'authored.txt': 'keep\n' });
        const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(PACKAGE) });
        try {
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
            expect(await installPackages(directory.path, undefined)).toBeUndefined();
            expect(hasPackages(directory.path)).toBe(true);
            expect(getOwnership(directory.path).files.map((file) => file.path)).toStrictEqual([
                '.gspot/config/vale.ini',
            ]);
            await verify(directory.path);
        } finally {
            await server.stop(true);
        }
    },
    60_000,
);
