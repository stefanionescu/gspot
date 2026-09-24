import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/run/session.ts';
import { applyAll } from '#cli/lifecycle/apply.ts';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, readFileSync } from 'node:fs';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { gitignoreBlock, applyBlock } from '#cli/emit/managed-blocks.ts';
import { parseManifest, configurationManifests } from '#cli/configurations/read-manifests.ts';

const CONFIGURATION =
    '\n[configuration]\nname = "local"\nkind = "policy"\ntitle = "Local"\ndescription = "Local tool files for the native ignore case."\n';

test.each([true, false])(
    'apply waits for Git before managing ignore entries with authored file=%s',
    async (authored) => {
        await using repository = await testdir();
        const original = '# Authored entries\nprivate.tmp\n';
        await createFileTree(repository.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
            ...(authored ? { '.gitignore': original } : {}),
        });
        await applyAll(await openSession(repository.path));
        const path = join(repository.path, '.gitignore');
        expect(existsSync(path)).toBe(authored);
        if (authored) expect(readFileSync(path, 'utf8')).toBe(original);
        const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        await applyAll(await openSession(repository.path));
        const installed = readFileSync(path, 'utf8');
        if (authored) expect(installed.startsWith(original)).toBe(true);
        expect(installed).toContain('.gspot/cache/');
        await applyAll(await openSession(repository.path));
        expect(readFileSync(path, 'utf8')).toBe(installed);
        const removed = await uninstallCommand({ cwd: repository.path, yes: true, isDryRun: false });
        expect(removed.exitCode).toBe(0);
        expect(existsSync(join(repository.path, '.gspot/state/ownership.json'))).toBe(true);
        expect(readFileSync(path, 'utf8')).toBe(installed);
        const retained = await run(['git', 'check-ignore', '--stdin', '-z'], {
            cwd: repository.path,
            stdin: '.gspot/state/ownership.json\0.gspot/state/recovery/original\0.gspot/authored.json\0source.md\0',
        });
        expect(retained.code, retained.stderr).toBe(0);
        expect(retained.stdout.split('\0').filter(Boolean)).toStrictEqual([
            '.gspot/state/ownership.json',
            '.gspot/state/recovery/original',
        ]);
    },
);

test('manifest-owned tool directories are ignored while generated rules and authored sources remain visible', async () => {
    await using repository = await testdir();
    const manifest = parseManifest('untracked = [".gspot/local/downloads/"]\n' + CONFIGURATION, 'configurations/local');
    const block = gitignoreBlock([...configurationManifests().values(), manifest, manifest]);
    const authored = '# Authored entries\nprivate.tmp\n';
    const content = applyBlock(authored, block, 'hash');
    await createFileTree(repository.path, { '.gitignore': content });
    expect(content.startsWith(authored)).toBe(true);
    expect(applyBlock(content, block, 'hash')).toBe(content);
    expect(content.match(/\.gspot\/local\/downloads\//gu)).toHaveLength(1);
    const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
    expect(initialized.code, initialized.stderr).toBe(0);
    const ignored = [
        'private.tmp',
        '.gspot/cache/result.json',
        '.gspot/local/downloads/rules.yml',
        '.gspot/config/vale/styles/Google/rule.yml',
    ];
    const tracked = [
        'guide.md',
        '.gspot/local/config.json',
        '.gspot/config/vale/styles/gspot/rule.yml',
        '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt',
    ];
    const checked = await run(['git', 'check-ignore', '--stdin', '-z'], {
        cwd: repository.path,
        stdin: [...ignored, ...tracked].join('\0') + '\0',
    });
    expect(checked.code, checked.stderr).toBe(0);
    expect(checked.stdout.split('\0').filter(Boolean)).toStrictEqual(ignored);
});

test.each([
    'source/',
    '../outside/',
    '.gspot/../source/',
    '.gspot/downloads/../../source/',
    '.gspot/./downloads/',
    '.gspot/downloads/\nsource/',
    '.gspot\\downloads\\',
])('a manifest cannot hide authored paths through %s', (path) => {
    expect(() =>
        parseManifest(`untracked = [${JSON.stringify(path)}]\n` + CONFIGURATION, 'configurations/local'),
    ).toThrow();
    expect(() =>
        parseManifest('untracked = [".gspot/downloads/"]\n' + CONFIGURATION, 'configurations/local'),
    ).not.toThrow();
});
