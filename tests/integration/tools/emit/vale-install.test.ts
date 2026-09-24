import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { installPackages, parseAlerts, hasPackages } from '#cli/prose/vale.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

// A ZIP containing LocalStyle/terms.yml, an existence rule rejecting ambiguousword.
const PACKAGE = Buffer.from(
    'UEsDBBQAAAAAAAAAIQC8KoVlUQAAAFEAAAAUAAAATG9jYWxTdHlsZS90ZXJtcy55bWxleHRlbmRzOiBleGlzdGVuY2UKbWVzc2FnZTogIkF2b2lkICclcycuIgpsZXZlbDogZXJyb3IKdG9rZW5zOgogIC0gYW1iaWd1b3Vzd29yZApQSwECFAMUAAAAAAAAACEAvCqFZVEAAABRAAAAFAAAAAAAAAAAAAAApAEAAAAATG9jYWxTdHlsZS90ZXJtcy55bWxQSwUGAAAAAAEAAQBCAAAAgwAAAAAA',
    'base64',
);

test('pinned Vale installs in isolation, publishes owned rules, and preserves edited installed rules', async () => {
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
                        `StylesPath = vale/styles\nPackages = http://127.0.0.1:${server.port}/LocalStyle.zip\n\n[*]\nBasedOnStyles = LocalStyle\n`,
                    ),
                    mode: 0o444,
                },
                'config',
            );
        } finally {
            owner.close();
        }
        expect(await installPackages(directory.path)).toBeUndefined();
        expect(hasPackages(directory.path, true)).toBe(true);
        const installed = '.gspot/config/vale/styles/LocalStyle/terms.yml';
        expect(
            readOwnership(directory.path).files.some((file) => file.path === installed && file.installed !== undefined),
        ).toBe(true);
        await using clone = await testdir();
        await createFileTree(clone.path, {
            '.gspot/config/vale.ini': readFileSync(join(directory.path, '.gspot/config/vale.ini'), 'utf8'),
            [installed]: readFileSync(join(directory.path, installed), 'utf8'),
        });
        const original = readFileSync(join(clone.path, installed));
        expect(await installPackages(clone.path)).toBeUndefined();
        const adopted = readOwnership(clone.path).files.find((file) => file.path === installed)!;
        expect(adopted.installed).toBeDefined();
        expect(adopted.original).toBeDefined();
        expect(readFileSync(join(clone.path, installed))).toStrictEqual(original);
        const command = ['vale', '--config', '.gspot/config/vale.ini', '--output', 'JSON', '--no-exit', 'guide.md'];
        const checked = await run(command, { cwd: directory.path });
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(parseAlerts(checked.stdout)).toStrictEqual([
            expect.objectContaining({
                file: 'guide.md',
                line: 1,
                check: 'LocalStyle.terms',
                message: "Avoid 'ambiguousword'.",
            }),
        ]);
        writeFileSync(join(directory.path, 'guide.md'), 'Clear writing.\n');
        const corrected = await run(command, { cwd: directory.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(parseAlerts(corrected.stdout)).toStrictEqual([]);
        const stale = '.gspot/config/vale/styles/Retired/terms.yml';
        const staleOwner = openLifecycleOwner(directory.path);
        try {
            staleOwner.replace(stale, { bytes: Buffer.from('installed old rule\n'), mode: 0o644 }, 'config');
        } finally {
            staleOwner.close();
        }
        writeFileSync(join(directory.path, stale), 'edited old rule\n');
        const beforeRefresh = readFileSync(join(directory.path, installed));
        expect(await installPackages(directory.path)).toContain(`preserved edited or unowned ${stale}`);
        expect(readFileSync(join(directory.path, stale), 'utf8')).toBe('edited old rule\n');
        expect(readFileSync(join(directory.path, installed))).toStrictEqual(beforeRefresh);
        writeFileSync(join(directory.path, stale), 'installed old rule\n');
        expect(await installPackages(directory.path)).toBeUndefined();
        expect(existsSync(join(directory.path, stale))).toBe(false);
        expect(await installPackages(directory.path)).toBeUndefined();
        expect(hasPackages(directory.path, true)).toBe(true);
        const edited = `${readFileSync(join(directory.path, installed), 'utf8')}# Authored later.\n`;
        chmodSync(join(directory.path, installed), 0o644);
        writeFileSync(join(directory.path, installed), edited);
        expect(await installPackages(directory.path)).toContain(`preserved edited or unowned ${installed}`);
        expect(readFileSync(join(directory.path, installed), 'utf8')).toBe(edited);
        expect(readFileSync(join(directory.path, 'authored.txt'), 'utf8')).toBe('keep\n');
    } finally {
        server.stop(true);
    }
}, 60_000);
