import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { alwaysSelectedConfigurations } from '#tests/harness/policy.ts';
import { selectConfigurations } from '#cli/configurations/selection/public.ts';

test('templates > init validates a template in a dry run without changing the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'team.template.toml': 'template = "team"\nselection = "exact"\nconfigurations = ["bash"]\n',
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
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(['exact', 'detect'])('an empty %s template controls root detection without writing', async (selection) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.js': 'export const port = 8080;\n',
        'team.template.toml': `template = "team"\nselection = "${selection}"\nconfigurations = []\n`,
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--from',
        'team.template.toml',
        '--dry-run',
        '--json',
        ...QUIET_INIT,
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const policy = parseStrictPolicy(report.policy);
    expect(policy.configurations.includes('javascript')).toBe(selection === 'detect');
    for (const configuration of alwaysSelectedConfigurations()) expect(policy.configurations).toContain(configuration);
    if (selection === 'exact')
        expect(policy.configurations.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            selectConfigurations(alwaysSelectedConfigurations(), configurationManifests())
                .map((manifest) => manifest.configuration.name)
                .toSorted((left, right) => left.localeCompare(right)),
        );
    expect(report.plan.template).toMatchObject({ name: 'team', selection });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('templates > a template with a wrong value, an unknown configuration and a path stops init before anything is written', async () => {
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
    await Bun.write(
        join(sandbox.path, 'bad.template.toml'),
        'template = "corrected"\nselection = "exact"\nconfigurations = ["bash"]\n',
    );
    commitAll(sandbox.path);
    const corrected = await runGspot(sandbox.path, ['init', '--yes', '--from', 'bad.template.toml', '--no-install']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const read = Bun.TOML.parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text()) as Record<string, unknown>;
    expect(read['configurations']).toStrictEqual(
        expect.arrayContaining([...alwaysSelectedConfigurations(), 'bash', 'commits']),
    );
});
