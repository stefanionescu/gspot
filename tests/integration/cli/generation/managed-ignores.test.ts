import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { applyBlock } from '#cli/generation/markers.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { kitManifests, parseManifest, gitignoreBlock } from '#cli/kits/manifests.ts';
import { MANAGED_IGNORES_CONFIGURATION } from '#tests/inputs/integration/cli/generation/generation.ts';

test.each([true, false])(
    'apply waits for Git before managing ignore entries with authored file=%s',
    async (authored) => {
        await using repository = await testdir();
        const original = '# Authored entries\nprivate.tmp\n';
        await createFileTree(repository.path, {
            'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
            ...(authored ? { '.gitignore': original } : {}),
        });
        await writeOutputs(await openSession(repository.path));
        const path = join(repository.path, '.gitignore');
        // Without Git there is nothing to manage: an authored file is untouched and none is created.
        expect(existsSync(path) ? readFileSync(path, 'utf8') : undefined).toBe(authored ? original : undefined);
        const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        await writeOutputs(await openSession(repository.path));
        const installed = readFileSync(path, 'utf8');
        expect(installed.startsWith(original)).toBe(authored);
        expect(installed).toContain('.gspot/state/');
        await writeOutputs(await openSession(repository.path));
        expect(readFileSync(path, 'utf8')).toBe(installed);
    },
);

test('manifest-owned tool directories are ignored while generated rules and authored sources remain visible', async () => {
    await using repository = await testdir();
    const manifest = parseManifest(
        'untracked = [".gspot/local/downloads/"]\n' + MANAGED_IGNORES_CONFIGURATION,
        'configurations/local',
    );
    const block = gitignoreBlock([...kitManifests().values(), manifest, manifest]);
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
        '.gspot/state/ownership.json',
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
        parseManifest(
            `untracked = [${JSON.stringify(path)}]\n` + MANAGED_IGNORES_CONFIGURATION,
            'configurations/local',
        ),
    ).toThrow();
    expect(() =>
        parseManifest('untracked = [".gspot/downloads/"]\n' + MANAGED_IGNORES_CONFIGURATION, 'configurations/local'),
    ).not.toThrow();
});
