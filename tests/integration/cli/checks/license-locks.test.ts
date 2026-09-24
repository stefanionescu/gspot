import { allowlistsMatch } from '#cli/checks/repository/allowlists-match.ts';
import { lockedPackages } from '#cli/repository/locked-packages.ts';
import { engineInput } from '#cli/run/engines.ts';
import { planRun } from '#cli/run/plan.ts';
import { openSession } from '#cli/run/session.ts';
import { run as runCli } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const LOCKS: [string, string][] = [
    [
        'package-lock.json',
        JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/example': { version: '1.2.3' } } }),
    ],
    ['bun.lock', '{"lockfileVersion":1,"packages":{"example":["example@1.2.3","",{},"sha512-fixture"]}}'],
    ['pnpm-lock.yaml', 'lockfileVersion: "9.0"\npackages:\n  example@1.2.3(peer@2.0.0): {}\n'],
    [
        'yarn.lock',
        '__metadata:\n  version: 8\n  cacheKey: 10c0\n"example@npm:^1.0.0":\n  version: 1.2.3\n  resolution: "example@npm:1.2.3"\n',
    ],
    ['uv.lock', 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['poetry.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
    ['pdm.lock', '[[package]]\nname = "example"\nversion = "1.2.3"\n'],
];

test.each(LOCKS)('license exceptions must match a resolved version in %s', async (filename, lock) => {
    await using repository = await testdir();
    const policy = (version: string): string =>
        `version = 1\nconfigurations = ["structure", "licenses"]\n[[tools.licenses.packages_allowed]]\npackage = "example@${version}"\nlicense = "BSD"\nreason = "Reviewed the installed license."\n`;
    await createFileTree(repository.path, { 'gspot.toml': policy('2.0.0'), [filename]: lock });
    const check = async () => {
        const session = await openSession(repository.path);
        const scope = session.scopes[0]!;
        const spec = scope.selected
            .flatMap((configuration) => configuration.checks)
            .find((check) => check.name === 'integrity/allowlists-match')!;
        return await allowlistsMatch(
            engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === '')!,
                spec: spec,
                files: session.repository.files,
            }),
        );
    };
    expect(await check()).toStrictEqual([
        expect.objectContaining({ rule: 'unlocked-package', message: expect.stringContaining('example@2.0.0') }),
    ]);
    await Bun.write(`${repository.path}/gspot.toml`, policy('1.2.3'));
    expect(await check()).toStrictEqual([]);
});

test.each(LOCKS)('malformed %s cannot prove exception membership', (filename) => {
    expect(() => lockedPackages(filename, '{ broken lockfile')).toThrow();
});

test('scoped license exceptions use ancestor workspace locks but not sibling or private tool locks', async () => {
    await using repository = await testdir();
    const root = repository.path;
    const lock = 'version = 1\n[[package]]\nname = "Example_Package"\nversion = "1.2.3"\n';
    await createFileTree(root, {
        'gspot.toml':
            'version = 1\nconfigurations = ["structure", "licenses"]\n[[scope]]\npath = "app"\n[[scope.tools.licenses.packages_allowed]]\npackage = "example-package@1.2.3"\nlicense = "BSD"\nreason = "Reviewed dependency metadata."\n',
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
        return await allowlistsMatch(
            engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === '')!,
                spec: spec,
                files: session.repository.files,
            }),
        );
    };
    await expect(check()).rejects.toThrow('require a dependency lockfile');
    await Bun.write(`${root}/uv.lock`, lock);
    expect(await check()).toStrictEqual([]);
});

test('npm lockfiles retain resolved alias names, scoped names, and nested versions', () => {
    const classic = JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
            '@types/is-number': { version: '7.0.5' },
            'named-alias': { version: 'npm:is-number@7.0.0', dependencies: { example: { version: '2.0.0' } } },
            example: { version: '1.0.0' },
        },
    });
    const modern = JSON.stringify({
        lockfileVersion: 3,
        packages: {
            'node_modules/@types/is-number': { version: '7.0.5' },
            'node_modules/named-alias': { name: 'is-number', version: '7.0.0' },
            'node_modules/named-alias/node_modules/example': { version: '2.0.0' },
            'node_modules/example': { version: '1.0.0' },
        },
    });
    const identities = lockedPackages('package-lock.json', classic);
    expect(identities).toStrictEqual(lockedPackages('package-lock.json', modern));
    expect(identities.has('is-number@7.0.0')).toBe(true);
    expect(identities.has('named-alias@7.0.0')).toBe(false);
    expect(identities.has('example@1.0.0')).toBe(true);
    expect(identities.has('example@2.0.0')).toBe(true);
});

test('Yarn classic aliases retain resolved names instead of installation names', () => {
    const lock = `# yarn lockfile v1
"named-alias@npm:is-number@7.0.0":
  version "7.0.0"
"types-alias@npm:@types/is-number@7.0.5":
  version "7.0.5"
"@types/is-number@7.0.5":
  version "7.0.5"
`;
    expect(lockedPackages('yarn.lock', lock)).toStrictEqual(new Set(['is-number@7.0.0', '@types/is-number@7.0.5']));
});

test.each(['root', 'nested', 'combined'])(
    'license selection %s runs its referenced integrity check once without adding structure',
    async (selection) => {
        await using repository = await testdir();
        const root = repository.path;
        const exception =
            '\n[[tools.licenses.packages_allowed]]\npackage = "example@2.0.0"\nlicense = "BSD"\nreason = "Reviewed package metadata."\n';
        const selected =
            selection === 'nested'
                ? 'configurations = []\n[[scope]]\npath = "app"\nconfigurations = ["licenses"]\n'
                : `configurations = ["licenses"${selection === 'combined' ? ', "structure"' : ''}]\n`;
        await createFileTree(root, {
            'gspot.toml':
                'version = 1\n' +
                selected +
                (selection === 'nested' ? exception.replace('[[tools.', '[[scope.tools.') : exception),
            'app/source.py': 'selected = True\n',
            'uv.lock': 'version = 1\n[[package]]\nname = "example"\nversion = "1.2.3"\n',
        });
        const session = await openSession(root);
        const plan = await planRun(session, { stage: 'commit', only: ['integrity/allowlists-match'], skips: [] });
        expect(plan).toHaveLength(1);
        if (selection !== 'combined')
            expect(
                session.scopes
                    .flatMap((scope) => scope.selected)
                    .some((manifest) => manifest.configuration.name === 'structure'),
            ).toBe(false);
        const result = await runCli(root, ['check', '--only', 'integrity/allowlists-match', '--no-cache', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(JSON.parse(result.stdout).checks).toMatchObject([
            { check: 'integrity/allowlists-match', findings: [{ rule: 'unlocked-package' }] },
        ]);
    },
);
