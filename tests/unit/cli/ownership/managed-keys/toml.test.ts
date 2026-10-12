import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { applyBlock } from '#cli/system/managed-blocks.ts';
import { fileMode } from '#cli/system/safe-folder/reads.ts';
import { TWO_WEEKS_SECONDS } from '#tests/config/dependencies.ts';
import { stat, chmod, readFile, writeFile } from 'node:fs/promises';
import { applyPlans, openOwnershipLog } from '#cli/ownership/log.ts';
import { OWNERSHIP_REFUSAL } from '#tests/config/generated-files.ts';
import { planBlock, planManagedKeys, planRestoration } from '#cli/ownership/plans.ts';

{
    test('managed TOML tasks refuse a malformed file and an edited key, and create new tables', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'broken.toml': '[tasks\n' });
        {
            using log = openOwnershipLog(directory.path);

            const changes = [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }];
            expect(() => planManagedKeys(log, 'broken.toml', changes, true)).toThrow('broken.toml');
            expect(await readFile(join(directory.path, 'broken.toml'), 'utf8')).toBe('[tasks\n');
            applyPlans(log, [planManagedKeys(log, 'mise.toml', changes)]);
            const installed = await readFile(join(directory.path, 'mise.toml'), 'utf8');
            expect(parseToml(installed)).toStrictEqual({ tasks: { 'gspot:check': { run: 'gspot check' } } });
            await writeFile(join(directory.path, 'mise.toml'), installed.replace('gspot check', 'authored check'));
            expect(() => {
                applyPlans(log, [planRestoration(log, 'mise.toml')]);
            }).toThrow(`These files were not overwritten by gspot: mise.toml${OWNERSHIP_REFUSAL}`);
            expect(await readFile(join(directory.path, 'mise.toml'), 'utf8')).toContain('authored check');
        }
    });

    test.each(['json', 'toml'])('giving back managed keys keeps your non-UTF-8 edit of a %s file', async (format) => {
        await using sandbox = await testdir();
        const path = `config.${format}`;
        await createFileTree(sandbox.path, { [path]: format === 'json' ? '{}\n' : 'authored = true\n' });
        using log = openOwnershipLog(sandbox.path);
        applyPlans(log, [planManagedKeys(log, path, [{ path: ['owned'], value: true }], true)]);
        const authored = Buffer.from([0xff]);
        await writeFile(join(sandbox.path, path), authored);
        const recorded = structuredClone(log.state);
        expect(() => {
            applyPlans(log, [planRestoration(log, path)]);
        }).toThrow(`These files were not overwritten by gspot: ${path}${OWNERSHIP_REFUSAL}`);
        expect(await readFile(join(sandbox.path, path))).toStrictEqual(authored);
        expect(log.state).toStrictEqual(recorded);
    });
}
{
    test('a managed TOML key keeps nearby edits through update and removal', async () => {
        await using directory = await testdir();
        const original = '# Keep this comment.\nextends = "./authored.json"\n[compilerOptions]\nstrict = false\n';
        await createFileTree(directory.path, { 'compiler.toml': original });
        {
            using log = openOwnershipLog(directory.path);
            applyPlans(log, [
                planManagedKeys(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/first.json' }], true),
            ]);
            const installed = log.files.read('compiler.toml')!.bytes.toString('utf8');
            const edited = installed.replace('strict = false', 'strict = true');
            await writeFile(join(directory.path, 'compiler.toml'), edited);
            applyPlans(log, [
                planManagedKeys(log, 'compiler.toml', [{ path: ['extends'], value: './.gspot/second.json' }]),
            ]);
            expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
                edited.replace('./.gspot/first.json', './.gspot/second.json'),
            );
        }
        {
            using log = openOwnershipLog(directory.path);
            applyPlans(log, [planRestoration(log, 'compiler.toml')]);
            expect(log.files.read('compiler.toml')!.bytes.toString('utf8')).toBe(
                original.replace('strict = false', 'strict = true'),
            );
        }
    });

    test('removing managed TOML keys puts back their old values and keeps your edits', async () => {
        await using directory = await testdir();
        const original = 'private = true\noptional = true\n[scripts]\nprepare = "build-app"\ncheck = "gspot check"\n';
        await createFileTree(directory.path, { 'package.toml': original });
        {
            using log = openOwnershipLog(directory.path);

            applyPlans(log, [
                planManagedKeys(
                    log,
                    'package.toml',
                    [
                        { path: ['scripts', 'prepare'], value: 'gspot apply' },
                        { path: ['scripts', 'check'], value: 'gspot check' },
                        { path: ['optional'], value: false },
                    ],
                    true,
                ),
            ]);
            const edited = log.files
                .read('package.toml')!
                .bytes.toString('utf8')
                .replace('private = true', 'private = false');
            await writeFile(join(directory.path, 'package.toml'), edited);
            applyPlans(log, [
                planManagedKeys(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
            ]);
            expect(log.files.read('package.toml')!.bytes.toString('utf8')).toBe(
                original.replace('private = true', 'private = false'),
            );
            applyPlans(log, [planRestoration(log, 'package.toml')]);
            expect(log.files.read('package.toml')!.bytes.toString('utf8')).toBe(
                original.replace('private = true', 'private = false'),
            );
        }
    });

    test('adopting identical TOML keys and giving them back keeps the bytes and mode', async () => {
        await using directory = await testdir();
        const content = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
        await createFileTree(directory.path, { 'package.toml': content });
        await chmod(join(directory.path, 'package.toml'), 0o640);
        {
            using log = openOwnershipLog(directory.path);

            applyPlans(log, [
                planManagedKeys(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }], true),
            ]);
            applyPlans(log, [planRestoration(log, 'package.toml')]);
            expect(await readFile(join(directory.path, 'package.toml'), 'utf8')).toBe(content);
            const metadata = await stat(join(directory.path, 'package.toml'));
            expect(metadata.mode & 0o777).toBe(fileMode({ mode: 0o640 }));
        }
    });

    test('identical unrecorded blocks and keys survive adoption, later edits and give-back', async () => {
        await using directory = await testdir();
        const instructions = applyBlock('Authored instructions.\n', 'existing instructions', {
            path: 'AGENTS.md',
            style: 'markdown',
        });
        const configuration = 'authored = true\n[scripts]\ncheck = "gspot check"\n';
        await createFileTree(directory.path, { 'AGENTS.md': instructions, 'package.toml': configuration });
        {
            using log = openOwnershipLog(directory.path);

            applyPlans(log, [
                planBlock(log, 'AGENTS.md', 'existing instructions', 'markdown'),
                planManagedKeys(log, 'package.toml', [{ path: ['scripts', 'check'], value: 'gspot check' }]),
            ]);
            await writeFile(join(directory.path, 'AGENTS.md'), instructions + 'Later authored instructions.\n');
            await writeFile(join(directory.path, 'package.toml'), configuration.replace('true', 'false'));
            applyPlans(
                log,
                ['AGENTS.md', 'package.toml'].map((path) => planRestoration(log, path)),
            );
            expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(
                instructions + 'Later authored instructions.\n',
            );
            expect(await readFile(join(directory.path, 'package.toml'), 'utf8')).toBe(
                configuration.replace('true', 'false'),
            );
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
        }
    });

    test('managed TOML keys remove the empty parents gspot created and keep yours', async () => {
        const source = 'authored = true\n[kept]\n';
        await using directory = await testdir();
        const path = 'config.toml';
        await createFileTree(directory.path, { [path]: source });
        const log = openOwnershipLog(directory.path);
        const fields = [
            { path: ['created', 'nested', 'first'], value: 1 },
            { path: ['created', 'nested', 'second'], value: 2 },
            { path: ['created', 'nested', 'third'], value: 3 },
            { path: ['created', 'nested', 'fourth'], value: 4 },
            { path: ['kept', 'owned'], value: true },
        ];
        try {
            applyPlans(log, [planManagedKeys(log, path, fields, true)]);
            const installed = log.files.read(path)!.bytes.toString('utf8');
            const edited = installed.replace('fourth = 4', 'fourth = 99');
            await writeFile(join(directory.path, path), edited);
            expect(() => {
                applyPlans(log, [planManagedKeys(log, path, [])]);
            }).toThrow(`These files were not overwritten by gspot: ${path}${OWNERSHIP_REFUSAL}`);
            expect(log.files.read(path)!.bytes.toString('utf8')).toBe(edited);
            await writeFile(join(directory.path, path), installed);
            applyPlans(log, [planManagedKeys(log, path, [fields[1]!])]);
            expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({
                authored: true,
                kept: {},
                created: { nested: { second: 2 } },
            });
            applyPlans(log, [planManagedKeys(log, path, [])]);
            expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({ authored: true, kept: {} });
            applyPlans(log, [planManagedKeys(log, path, fields, true)]);
            await writeFile(
                join(directory.path, path),
                log.files.read(path)!.bytes.toString('utf8').replace('authored = true', 'authored = false'),
            );
            applyPlans(log, [planRestoration(log, path)]);
            expect(parseToml(log.files.read(path)!.bytes.toString('utf8'))).toStrictEqual({
                authored: false,
                kept: {},
            });
        } finally {
            log[Symbol.dispose]();
        }
    });
}
{
    test('Bun release-age keys keep a stricter age and your other fields through merge and restore', async () => {
        await using repository = await testdir();
        const original = '# Authored installation choices\n[install]\nexact = true\nminimumReleaseAge = 1209600\n';
        await createFileTree(repository.path, {
            'gspot.toml': settingsText(['dependencies'], {
                tables: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
            }),
            'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
            'bunfig.toml': original,
        });
        const session = await openSession(repository.path);
        const generated = emitAll(session).fileEdits.find((entry) => entry.path === 'bunfig.toml')!;
        const log = openOwnershipLog(repository.path);
        applyPlans(log, [planManagedKeys(log, generated.path, generated.changes, true)]);
        const installed = await readFile(join(repository.path, 'bunfig.toml'), 'utf8');
        expect(Bun.TOML.parse(installed)).toStrictEqual({
            install: {
                exact: true,
                minimumReleaseAge: TWO_WEEKS_SECONDS,
                security: { scanner: '@socketsecurity/bun-security-scanner' },
            },
        });
        expect(installed).toContain('# Authored installation choices');
        applyPlans(log, [planManagedKeys(log, generated.path, generated.changes, true)]);
        applyPlans(log, [planRestoration(log, 'bunfig.toml')]);
        log[Symbol.dispose]();
        expect(await readFile(join(repository.path, 'bunfig.toml'), 'utf8')).toBe(original);
    });
}
