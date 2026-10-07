import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { staleAllowlists } from '#cli/checks/general/structure/stale-allowlists.ts';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';
import { LOCKFILES } from '#tests/config/cli/checks/general/structure/license-lockfiles.ts';

const POLICY = buildPolicy(['structure', 'licenses'], {
    tables: '[[licenses.exceptions]]\npackage = "example@2.0.0"\nlicense = "BSD"\nreason = "Reviewed the installed license."\n',
});

test.each(LOCKFILES)('license exceptions must match a resolved version in %s', async (filename, lockfile) => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': POLICY, [filename]: lockfile });
    const check = async () => {
        const session = await openSession(repository.path);
        const scope = session.scopes[0]!;
        const check = scope.selected
            .flatMap((configuration) => configuration.checks)
            .find((check) => check.name === 'structure/stale-allowlists')!;
        return staleAllowlists(buildCheckInput(session, check.name));
    };
    expect(await check()).toStrictEqual([
        containing({
            check: 'structure/stale-allowlists',
            file: 'gspot.toml',
            line: 1,
            rule: 'unlocked-package',
            message: textContaining('example@2.0.0'),
        }),
    ]);
    await Bun.write(`${repository.path}/gspot.toml`, POLICY.replace('example@2.0.0', 'example@1.2.3'));
    expect(await check()).toStrictEqual([]);
});

test('scoped license exceptions use ancestor workspace lockfiles but not sibling or private tool lockfiles', async () => {
    await using repository = await testdir();
    const root = repository.path;
    const lockfile = 'version = 1\n[[package]]\nname = "Example_Package"\nversion = "1.2.3"\n';
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['structure', 'licenses'], {
            tables: '[[scope]]\npath = "app"\n[[scope.licenses.exceptions]]\npackage = "example-package@1.2.3"\nlicense = "BSD"\nreason = "Reviewed dependency metadata."\n',
        }),
        'app/source.py': 'selected = True\n',
        'sibling/uv.lock': lockfile,
        '.gspot/uv.lock': lockfile,
    });
    const check = async () => {
        const session = await openSession(root);
        const scope = session.scopes[0]!;
        const check = scope.selected
            .flatMap((configuration) => configuration.checks)
            .find((check) => check.name === 'structure/stale-allowlists')!;
        return staleAllowlists(buildCheckInput(session, check.name));
    };
    expect(await rejection(check())).toContain('require a dependency lockfile');
    await Bun.write(`${root}/uv.lock`, lockfile);
    expect(await check()).toStrictEqual([]);
});

test.each(['root', 'nested', 'combined'])(
    'license selection %s runs its shared integrity check once with automatic structure coverage',
    async (selection) => {
        await using repository = await testdir();
        const root = repository.path;
        const exception =
            '\n[[licenses.exceptions]]\npackage = "example@2.0.0"\nlicense = "BSD"\nreason = "Reviewed package metadata."\n';
        const configurations = selection === 'combined' ? '"licenses", "structure"' : '"licenses"';
        const selected =
            selection === 'nested'
                ? 'configurations = []\n[[scope]]\npath = "app"\nconfigurations = ["licenses"]\n'
                : `configurations = [${configurations}]\n`;
        await createFileTree(root, {
            'gspot.toml':
                selected + (selection === 'nested' ? exception.replace('[[licenses.', '[[scope.licenses.') : exception),
            'app/source.py': 'selected = True\n',
            'uv.lock': 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n',
        });
        const session = await openSession(root);
        const plan = planRun(session, { stage: 'commit', only: ['structure/stale-allowlists'], skips: [] });
        expect(plan).toHaveLength(1);
        const selectsStructure = session.scopes
            .flatMap((scope) => scope.selected)
            .some((manifest) => manifest.configuration.name === 'structure');
        expect(selectsStructure).toBe(true);
        const options = buildRunOptions({ only: ['structure/stale-allowlists'] });
        const result = await executeRun(session, options);
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks).toMatchObject([
            {
                check: 'structure/stale-allowlists',
                status: 'failed',
                findings: [{ file: 'gspot.toml', line: 1, rule: 'unlocked-package' }],
            },
        ]);
        const path = `${root}/gspot.toml`;
        const policyText = await Bun.file(path).text();
        await Bun.write(path, policyText.replace('example@2.0.0', 'example@1.2.3'));
        const corrected = await executeRun(await openSession(root), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'structure/stale-allowlists', status: 'passed', findings: [] },
        ]);
    },
);
