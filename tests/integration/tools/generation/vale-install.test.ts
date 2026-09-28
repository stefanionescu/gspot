import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { parseAlerts } from '#cli/checks/prose/vale.ts';
import { containing } from '#tests/support/expectations.ts';
import { hasOwnedPackages, installPackages } from '#cli/tools/vale.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership/owner.ts';

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
        [INSTALLED]: readFileSync(join(root, INSTALLED), 'utf8'),
    });
    const original = readFileSync(join(clone.path, INSTALLED));
    expect(await installPackages(clone.path)).toBeUndefined();
    const adopted = readOwnership(clone.path).files.find((file) => file.path === INSTALLED)!;
    expect(adopted.installed).toBeDefined();
    expect(adopted.original).toBeDefined();
    expect(readFileSync(join(clone.path, INSTALLED))).toStrictEqual(original);
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
    const stale = '.gspot/config/vale/styles/Retired/terms.yml';
    const staleOwner = openLifecycleOwner(root);
    try {
        staleOwner.replace(stale, { bytes: Buffer.from('installed old rule\n'), mode: 0o644 }, 'config');
    } finally {
        staleOwner.close();
    }
    writeFileSync(join(root, stale), 'edited old rule\n');
    const beforeRefresh = readFileSync(join(root, INSTALLED));
    expect(await installPackages(root)).toContain(`preserved edited or unowned ${stale}`);
    expect(readFileSync(join(root, stale), 'utf8')).toBe('edited old rule\n');
    expect(readFileSync(join(root, INSTALLED))).toStrictEqual(beforeRefresh);
    writeFileSync(join(root, stale), 'installed old rule\n');
    expect(await installPackages(root)).toBeUndefined();
    expect(existsSync(join(root, stale))).toBe(false);
    expect(await installPackages(root)).toBeUndefined();
    expect(hasOwnedPackages(root)).toBe(true);
}

async function expectEditedRules(root: string): Promise<void> {
    const edited = `${readFileSync(join(root, INSTALLED), 'utf8')}# Authored later.\n`;
    chmodSync(join(root, INSTALLED), 0o644);
    writeFileSync(join(root, INSTALLED), edited);
    expect(await installPackages(root)).toContain(`preserved edited or unowned ${INSTALLED}`);
    expect(readFileSync(join(root, INSTALLED), 'utf8')).toBe(edited);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
}

test.each([
    { name: 'publishes owned rules, adopts cloned bytes, and checks corrections', verify: expectPublishedRules },
    { name: 'preserves edited retired rules and prunes restored rules', verify: expectPrunedRules },
    { name: 'preserves edited installed rules and unrelated authored files', verify: expectEditedRules },
])(
    'pinned Vale $name',
    async ({ verify }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'guide.md': 'An ambiguousword.\n', 'authored.txt': 'keep\n' });
        const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response(PACKAGE) });
        try {
            const pin = configurationManifests()
                .get('prose')!
                .tools.find((tool) => tool.name === 'vale')!.version!;
            const version = await run(['vale', '--version'], { cwd: directory.path });
            expect(version.code, version.stdout + version.stderr).toBe(0);
            expect(version.stdout).toContain(pin);
            const owner = openLifecycleOwner(directory.path);
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
            expect(hasOwnedPackages(directory.path)).toBe(true);
            expect(
                readOwnership(directory.path).files.some(
                    (file) => file.path === INSTALLED && file.installed !== undefined,
                ),
            ).toBe(true);
            await verify(directory.path);
        } finally {
            await server.stop(true);
        }
    },
    60_000,
);
