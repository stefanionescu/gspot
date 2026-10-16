import { join } from 'node:path';
import { parse } from 'smol-toml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { TYPO } from '#tests/config/spelling.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { ALWAYS_SELECTED } from '#tests/config/configurations.ts';

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
    const original = parse(await Bun.file(join(sandbox.path, 'team.template.toml')).text());
    expect(parse(report.settings)['command_check']).toStrictEqual(original['command_check']);
    expect(
        Object.keys(parseSettings(report.settings, sandbox.path, createReadCache(process.cwd())).check),
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
    for (const configuration of ALWAYS_SELECTED) expect(selected).toContain(configuration);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('a template with an unknown configuration stops init before anything is written', async () => {
    await using sandbox = await testdir({
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'bad.template.toml': `configurations = ["${TYPO.spelling}"]\n`,
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    for (const flags of [[], ['--dry-run']]) {
        const result = await runGspot(sandbox.path, [
            'init',
            '--yes',
            '--from',
            'bad.template.toml',
            '--json',
            ...flags,
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'template', message: textContaining(TYPO.spelling) });
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
});

test('init --from an exported template writes the same settings in another repository', async () => {
    await using sandbox = await testdir({
        source: { 'source.sh': CLEAN_BASH_SCRIPT },
        destination: { 'source.sh': CLEAN_BASH_SCRIPT },
    });
    const source = join(sandbox.path, 'source');
    const destination = join(sandbox.path, 'destination');
    commitAll(source);
    commitAll(destination);
    for (const argv of [
        buildInitArguments(['bash']),
        ['set', 'level', 'all'],
        ['set', 'format.indent_width', '2'],
        ['export', 'house.template.toml'],
    ]) {
        const result = await runGspot(source, argv);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const template = join(source, 'house.template.toml');
    const copied = await runGspot(destination, [...buildInitArguments([]), '--from', template]);
    expect(copied.code, copied.stdout + copied.stderr).toBe(0);
    expect(parse(await Bun.file(join(destination, 'gspot.toml')).text())).toStrictEqual(
        parse(await Bun.file(join(source, 'gspot.toml')).text()),
    );
    const exported = await runGspot(destination, ['export', 'house.template.toml']);
    expect(exported.code, exported.stdout + exported.stderr).toBe(0);
    expect(parse(await Bun.file(join(destination, 'house.template.toml')).text())).toStrictEqual(
        parse(await Bun.file(template).text()),
    );
});
