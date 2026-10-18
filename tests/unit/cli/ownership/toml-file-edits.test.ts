import { join } from 'node:path';
import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { planRemoval, planManagedKeys } from '#cli/ownership/plans.ts';
import { TWO_WEEKS_SECONDS } from '#tests/data/checks/dependencies.ts';

describe('toml-file-edits', () => {
    test('managed TOML tasks refuse a malformed file and an edited key, and create new tables', async () => {
        await using folder = await testdir();
        await createFileTree(folder.path, { 'broken.toml': '[tasks\n' });
        {
            using log = openWriter(folder.path);
            const changes = [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
            expect(() => planManagedKeys(log, 'broken.toml', changes)).toThrow('broken.toml');
            expect(await readFile(join(folder.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
            writePlans(log, [planManagedKeys(log, 'mise.toml', changes)]);
            const installed = await readFile(join(folder.path, 'mise.toml'), 'utf8');
            expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
            await writeFile(join(folder.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
            writePlans(log, [planManagedKeys(log, 'mise.toml', changes)]);
            expect(await readFile(join(folder.path, 'mise.toml'), 'utf8')).toContain('gspot check');
        }
    });
});

describe('toml-file-edits', () => {
    test('a managed TOML key keeps nearby edits through update and removal', async () => {
        await using folder = await testdir();
        const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
        await createFileTree(folder.path, { 'compiler.toml': original });
        {
            using log = openWriter(folder.path);
            writePlans(log, [
                planManagedKeys(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/first.json' }]),
            ]);
            const installed = log.files.read('compiler.toml')!.bytes.toString('utf8');
            const edited = installed.replace('strict = false', 'strict = true');
            await writeFile(join(folder.path, 'compiler.toml'), edited);
            writePlans(log, [
                planManagedKeys(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/second.json' }]),
            ]);
            expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
                edited.replace('./.gspot/first.json', './.gspot/second.json'),
            );
        }
        {
            using log = openWriter(folder.path);
            writePlans(log, [planRemoval(log, 'compiler.toml')]);
            expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
                original.replace('strict = false', 'strict = true').replace('./authored.json', './.gspot/second.json'),
            );
        }
    });
    test('adopting identical TOML keys and giving them back keeps the bytes and mode', async () => {
        await using folder = await testdir();
        const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
        await createFileTree(folder.path, { 'package.toml': content });
        await chmod(join(folder.path, 'package.toml'), 0o640);
        {
            using log = openWriter(folder.path);
            writePlans(log, [
                planManagedKeys(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
            ]);
            writePlans(log, [planRemoval(log, 'package.toml')]);
            expect(await readFile(join(folder.path, 'package.toml'), 'utf8')).toBe(content);
            const metadata = await stat(join(folder.path, 'package.toml'));
            expect(metadata.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        }
    });
});

describe('toml-file-edits', () => {
    test('the Bun scanner key keeps your own bunfig.toml fields when management stops', async () => {
        await using repository = await testdir();
        const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
        await createFileTree(repository.path, {
            'gspot.toml': buildSettingsText(['dependencies'], {
                tables: '[dependencies]\nbun_scanner = "@socketsecurity/bun-security-scanner"\n',
            }),
            'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
            'bunfig.toml': original,
        });
        const session = await openSession(repository.path);
        const generated = generate(session).fileEdits.find((entry) => entry.path === 'bunfig.toml')!;
        const log = openWriter(repository.path);
        writePlans(log, [planManagedKeys(log, generated.path, generated.changes)]);
        const installed = await readFile(join(repository.path, 'bunfig.toml'), 'utf8');
        expect(Bun.TOML.parse(installed)).toStrictEqual({
            install: {
                exact: true,
                minimumReleaseAge: TWO_WEEKS_SECONDS,
                security: { scanner: '@socketsecurity/bun-security-scanner' },
            },
        });
        expect(installed).toContain('# Authored installation choices');
        writePlans(log, [planManagedKeys(log, generated.path, generated.changes)]);
        writePlans(log, [planRemoval(log, 'bunfig.toml')]);
        log[Symbol.dispose]();
        expect(await readFile(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(installed);
    });
});
