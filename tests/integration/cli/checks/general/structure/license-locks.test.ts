import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { allowlistsMatch } from '#cli/checks/general/structure/stale-allowlists.ts';
import { rejection, containing, textContaining } from '#tests/harness/expectations.ts';

// One JavaScript and one Python lockfile: the parsing of every format is a unit test.
const LOCKS: [string, string][] = [
    [
        'package-lock.json',
        JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/example': { version: '1.2.3' } } }),
    ],
    ['uv.lock', 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n'],
];

const POLICY = policyOf(
    ['structure', 'licenses'],
    '[[tools.licenses.packages_allowed]]\npackage = "example@2.0.0"\nlicense = "BSD"\nreason = "Reviewed the installed license."\n',
);

test.each(LOCKS)('license exceptions must match a resolved version in %s', async (filename, lock) => {
    await using repository = await testdir();
    await createFileTree(repository.path, { 'gspot.toml': POLICY, [filename]: lock });
    const check = async () => {
        const session = await openSession(repository.path);
        const scope = session.scopes[0]!;
        const spec = scope.selected
            .flatMap((configuration) => configuration.checks)
            .find((check) => check.name === 'integrity/allowlists-match')!;
        return allowlistsMatch(scopeInput(session, spec));
    };
    expect(await check()).toStrictEqual([
        containing({
            check: 'integrity/allowlists-match',
            file: 'gspot.toml',
            line: 1,
            rule: 'unlocked-package',
            message: textContaining('example@2.0.0'),
        }),
    ]);
    await Bun.write(`${repository.path}/gspot.toml`, POLICY.replace('example@2.0.0', 'example@1.2.3'));
    expect(await check()).toStrictEqual([]);
});

test('scoped license exceptions use ancestor workspace locks but not sibling or private tool locks', async () => {
    await using repository = await testdir();
    const root = repository.path;
    const lock = 'version = 1\n[[package]]\nname = "Example_Package"\nversion = "1.2.3"\n';
    await createFileTree(root, {
        'gspot.toml': policyOf(
            ['structure', 'licenses'],
            '[[scope]]\npath = "app"\n[[scope.tools.licenses.packages_allowed]]\npackage = "example-package@1.2.3"\nlicense = "BSD"\nreason = "Reviewed dependency metadata."\n',
        ),
        'app/source.py': 'selected = True\n',
        'sibling/uv.lock': lock,
        '.gspot/uv.lock': lock,
    });
    const check = async () => {
        const session = await openSession(root);
        const scope = session.scopes[0]!;
        const spec = scope.selected
            .flatMap((configuration) => configuration.checks)
            .find((check) => check.name === 'integrity/allowlists-match')!;
        return allowlistsMatch(scopeInput(session, spec));
    };
    expect(await rejection(check())).toContain('require a dependency lockfile');
    await Bun.write(`${root}/uv.lock`, lock);
    expect(await check()).toStrictEqual([]);
});

test.each(['root', 'nested', 'combined'])(
    'license selection %s runs its referenced integrity check once without adding structure',
    async (selection) => {
        await using repository = await testdir();
        const root = repository.path;
        const exception =
            '\n[[tools.licenses.packages_allowed]]\npackage = "example@2.0.0"\nlicense = "BSD"\nreason = "Reviewed package metadata."\n';
        const configurations = selection === 'combined' ? '"licenses", "structure"' : '"licenses"';
        const selected =
            selection === 'nested'
                ? 'kits = []\n[[scope]]\npath = "app"\nkits = ["licenses"]\n'
                : `kits = [${configurations}]\n`;
        await createFileTree(root, {
            'gspot.toml':
                selected + (selection === 'nested' ? exception.replace('[[tools.', '[[scope.tools.') : exception),
            'app/source.py': 'selected = True\n',
            'uv.lock': 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n',
        });
        const session = await openSession(root);
        const plan = planRun(session, { stage: 'commit', only: ['integrity/allowlists-match'], skips: [] });
        expect(plan).toHaveLength(1);
        const selectsStructure = session.scopes
            .flatMap((scope) => scope.selected)
            .some((manifest) => manifest.kit.name === 'structure');
        expect(selectsStructure).toBe(selection === 'combined');
        const options = runOptions({ only: ['integrity/allowlists-match'] });
        const result = await executeRun(session, options);
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks).toMatchObject([
            {
                check: 'integrity/allowlists-match',
                status: 'fail',
                findings: [{ file: 'gspot.toml', line: 1, rule: 'unlocked-package' }],
            },
        ]);
        const path = `${root}/gspot.toml`;
        const policyText = await Bun.file(path).text();
        await Bun.write(path, policyText.replace('example@2.0.0', 'example@1.2.3'));
        const corrected = await executeRun(await openSession(root), options);
        expect(corrected.report.exitCode).toBe(0);
        expect(corrected.report.checks).toMatchObject([
            { check: 'integrity/allowlists-match', status: 'ok', findings: [] },
        ]);
    },
);
