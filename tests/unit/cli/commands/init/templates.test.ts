import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/git.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { type InitJson } from '#cli/types/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { buildInitArguments, listAlwaysSelected } from '#tests/setup/builders.ts';

test('init --dry-run --from checks a template and writes nothing', async () => {
    await using sandbox = await testdir({
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'team.template.toml': `configurations = ["bash"]
[[command_check]]
name = "reviewed"
command = ["git", "status"]
paths = ["**/*"]
stage = "manual"
`,
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--from',
        'team.template.toml',
        '--dry-run',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings' | 'plan'>>;
    expect(JSON.parse(result.stdout)).toMatchObject({
        dryRun: true,
        plan: { template: { source: 'team.template.toml' } },
    });
    const original = parse(await Bun.file(join(sandbox.path, 'team.template.toml')).text()) as TomlTable;
    expect((parse(report.settings) as TomlTable)['command_check']).toStrictEqual(original['command_check']);
    expect(
        Object.keys(parseSettings(report.settings, sandbox.path, createReadCache(process.cwd())).commandChecks),
    ).toStrictEqual(['reviewed']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('an empty template still lets init add the detected configurations, and a dry run writes nothing', async () => {
    await using sandbox = await testdir({
        'source.js': 'export const port = 8080;\n',
        'team.template.toml': 'configurations = []\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments([], { json: true }),
        '--from',
        'team.template.toml',
        '--dry-run',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings' | 'plan'>>;
    expect(parseSettings(report.settings, undefined, createReadCache(process.cwd())).configurations).toContain(
        'javascript',
    );
    const selected = report.plan.configurations.map(({ configuration }) => configuration);
    for (const configuration of listAlwaysSelected()) expect(selected).toContain(configuration);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([[], ['--dry-run']].map((flags) => ({ flags })))(
    'a template with an unknown configuration stops init before anything is written (%j)',
    async ({ flags }) => {
        await using sandbox = await testdir({
            'scripts/a.sh': CLEAN_BASH_SCRIPT,
            'bad.template.toml': `configurations = ["${TYPO.spelling}"]\n`,
        });
        commitAll(sandbox.path);
        const before = await readTree(sandbox.path);

        const result = await runGspot(sandbox.path, [
            'init',
            '--yes',
            '--from',
            'bad.template.toml',
            '--json',
            ...flags,
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'template', message: matchSubstring(TYPO.spelling) });
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);
