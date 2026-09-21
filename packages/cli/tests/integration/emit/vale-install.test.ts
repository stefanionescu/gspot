import { join } from 'node:path';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#cli/platform/spawn.ts';
import { openLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';
import { installPackages, parseAlerts } from '#cli/prose/vale.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';

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
        const pin = presetManifests()
            .get('prose')!
            .tools.find((tool) => tool.name === 'vale')!.version!;
        const version = await run(['vale', '--version'], { cwd: directory.path });
        expect(version.code, version.stdout + version.stderr).toBe(0);
        expect(version.stdout).toContain(pin);
        const owner = openLifecycleOwner(directory.path);
        try {
            owner.replace(
                '.gspot/vale.ini',
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
        const installed = '.gspot/vale/styles/LocalStyle/terms.yml';
        expect(
            readOwnership(directory.path).files.some((file) => file.path === installed && file.installed !== undefined),
        ).toBe(true);
        const command = ['vale', '--config', '.gspot/vale.ini', '--output', 'line', '--no-exit', 'guide.md'];
        const checked = await run(command, { cwd: directory.path });
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(parseAlerts(checked.stdout)).toEqual([
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
        expect(parseAlerts(corrected.stdout)).toEqual([]);
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
