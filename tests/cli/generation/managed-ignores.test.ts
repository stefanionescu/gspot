import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { gitignoreBlock } from '#cli/generation/outputs.ts';
import { applyBlock } from '#cli/platform/managed-blocks.ts';
import { parseManifest } from '#cli/parsers/configurations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { MANAGED_IGNORES_CONFIGURATION } from '#tests/config/cli/generation/managed-ignores.ts';

test.each([true, false])(
    'apply waits for Git before managing ignore entries with authored file=%s',
    async (authored) => {
        await using repository = await testdir();
        const original = '# Authored entries\nprivate.tmp\n';
        await createFileTree(repository.path, {
            'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
            ...(authored ? { '.gitignore': original } : {}),
        });
        {
            using log = openOwnership(repository.path);
            writeOutputs(await openSession(repository.path), log);
        }
        const path = join(repository.path, '.gitignore');
        // Without Git there is nothing to manage: an authored file is untouched and none is created.
        expect(existsSync(path) ? readFileSync(path, 'utf8') : undefined).toBe(authored ? original : undefined);
        const initialized = await run(['git', 'init', '--quiet'], { cwd: repository.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        {
            using log = openOwnership(repository.path);
            writeOutputs(await openSession(repository.path), log);
        }
        const installed = readFileSync(path, 'utf8');
        expect(installed.startsWith(original)).toBe(authored);
        expect(installed).toContain('.gspot/state/');
        {
            using log = openOwnership(repository.path);
            writeOutputs(await openSession(repository.path), log);
        }
        expect(readFileSync(path, 'utf8')).toBe(installed);
    },
);

test('manifest-owned tool directories are ignored while generated rules and authored sources remain visible', async () => {
    await using repository = await testdir();
    const manifest = parseManifest(
        'ignored = [".gspot/local/downloads/"]\n' + MANAGED_IGNORES_CONFIGURATION,
        'configurations/general/local',
    );
    const block = gitignoreBlock([...configurationManifests().values(), manifest, manifest]);
    const authored = '# Authored entries\nprivate.tmp\n';
    const content = applyBlock(authored, block, { path: '.gitignore', style: 'hash' });
    await createFileTree(repository.path, { '.gitignore': content });
    expect(content.startsWith(authored)).toBe(true);
    expect(applyBlock(content, block, { path: '.gitignore', style: 'hash' })).toBe(content);
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

// One path per refusal: outside .gspot, a parent segment, a current segment, and a character no name holds.
test.each(['source/', '.gspot/../source/', '.gspot/./downloads/', '.gspot/downloads/\nsource/'])(
    'a manifest cannot hide authored paths through %s',
    (path) => {
        expect(() =>
            parseManifest(
                `ignored = [${JSON.stringify(path)}]\n` + MANAGED_IGNORES_CONFIGURATION,
                'configurations/general/local',
            ),
        ).toThrow();
        expect(() =>
            parseManifest(
                'ignored = [".gspot/downloads/"]\n' + MANAGED_IGNORES_CONFIGURATION,
                'configurations/general/local',
            ),
        ).not.toThrow();
    },
);
