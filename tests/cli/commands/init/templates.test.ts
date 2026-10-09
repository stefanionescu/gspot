import { join } from 'node:path';
import { parse } from 'smol-toml';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { alwaysSelectedConfigurations } from '#tests/harness/policy.ts';
import { selectConfigurations, configurationManifests } from '#cli/configurations/public.ts';

const templateDryRun = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'team.template.toml':
            'template = "team"\nselection = "exact"\nconfigurations = ["bash"]\n[check."__proto__"]\ncommand = ["git", "status"]\npaths = ["**/*"]\nstage = "manual"\n',
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
    expect(JSON.parse(result.stdout) as InitJson).toMatchObject({
        dryRun: true,
        plan: { template: { name: 'team', selection: 'exact' } },
    });
    const { policy } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy'>>;
    const original = parse(await Bun.file(join(sandbox.path, 'team.template.toml')).text());
    const emitted = parse(policy);
    expect(emitted['check']).toStrictEqual(original['check']);
    expect(Object.keys(parseStrictPolicy(policy, sandbox.path).check)).toStrictEqual(['__proto__']);
    expect(Object.hasOwn(Object.prototype, 'command')).toBe(false);
    for (const key of ['test_files', 'ci']) expect(Object.hasOwn(emitted, key)).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const written = await runGspot(sandbox.path, ['init', '--yes', '--from', 'team.template.toml', '--no-install']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text())['configurations']).toStrictEqual(['bash']);
    const session = await openSession(sandbox.path);
    const selected = session.scopes.flatMap(({ selected }) => selected.map((manifest) => manifest.configuration.name));
    for (const configuration of [...alwaysSelectedConfigurations(), 'bash', 'commits']) {
        expect(selected).toContain(configuration);
    }
};

const templateSelection = async (selection: string) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        'team.template.toml': `template = "team"\nselection = "${selection}"\nconfigurations = []\n`,
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        ...buildInitArguments([], { json: true }),
        '--from',
        'team.template.toml',
        '--dry-run',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const policy = parseStrictPolicy(report.policy);
    expect(policy.configurations.includes('javascript')).toBe(selection === 'detect');
    const selected = report.plan.configurations.map((entry) => entry.configuration);
    for (const configuration of alwaysSelectedConfigurations()) expect(selected).toContain(configuration);
    if (selection === 'exact') {
        expect(policy.configurations).toStrictEqual([]);
        expect(selected.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            selectConfigurations(alwaysSelectedConfigurations(), configurationManifests())
                .map((manifest) => manifest.configuration.name)
                .toSorted((left, right) => left.localeCompare(right)),
        );
    }
    expect(report.plan.template).toMatchObject({ name: 'team', selection });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
};

describe('templates', () => {
    test('init validates a template in a dry run without changing the repository', templateDryRun);

    test.each(['exact', 'detect'])('an empty %s template controls root detection without writing', templateSelection);

    test('a template with a wrong value, an unknown configuration and a path stops init before anything is written', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': CLEAN_BASH_SCRIPT,
            'bad.template.toml': `template = "bad"\nselection = "sometimes"\nconfigurations = ["${TYPO.spelling}"]\n\n[[ignore]]\ncheck = "spelling/typos"\npaths = ["a/**"]\nreason = "A reason that says something."\n`,
        });
        commitAll(sandbox.path);
        const init = await runGspot(sandbox.path, ['init', '--yes', '--from', 'bad.template.toml', '--json']);
        expect(init.code).toBe(2);
        expect(JSON.parse(init.stdout)).toMatchObject({ error: 'template', message: textContaining('selection') });
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
        const preview = await runGspot(sandbox.path, [
            'init',
            '--yes',
            '--from',
            'bad.template.toml',
            '--dry-run',
            '--json',
        ]);
        expect(preview.code).toBe(2);
        expect(JSON.parse(preview.stdout)).toMatchObject({ error: 'template', message: textContaining('selection') });
    });
});

test.each(['recommended', 'all'] as const)(
    'an exact template preserves its full root policy despite new general detection at %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            source: { 'source.sh': CLEAN_BASH_SCRIPT },
            destination: { 'source.sh': CLEAN_BASH_SCRIPT, 'index.ts': 'export const total = 3;\n' },
        });
        const source = join(sandbox.path, 'source');
        const destination = join(sandbox.path, 'destination');
        commitAll(source);
        commitAll(destination);
        for (const argv of [
            buildInitArguments(['bash']),
            ['set', 'level', level],
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
        const session = await openSession(destination);
        expect(
            session.scopes.flatMap(({ selected }) => selected.map((manifest) => manifest.configuration.name)),
        ).toContain('format');
        const exported = await runGspot(destination, ['export', 'house.template.toml']);
        expect(exported.code, exported.stdout + exported.stderr).toBe(0);
        expect(parse(await Bun.file(join(destination, 'house.template.toml')).text())).toStrictEqual(
            parse(await Bun.file(template).text()),
        );
    },
);
