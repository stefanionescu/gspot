import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/support/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { containingAll } from '#tests/support/expectations.ts';

test('native spelling file-type allowances preserve unrelated findings and neighboring files at all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['spelling'],
            `[tools.typos.extra]\nreason = "The fixture filename owns an external spelling; other words remain checked."\n[tools.typos.extra.type.fixture]\nextend-glob = ["fixture.txt"]\n[tools.typos.extra.type.fixture.extend-words]\ncolour = "${TYPO.color}"\n[tools.typos.extra.type.fixture.extend-identifiers]\nIIFEs = "IIFEs"\n`,
            'all',
        ),
        'fixture.txt': `${TYPO.color} ${TYPO.the}\nIIFEs\n`,
        'neighbor.txt': `${TYPO.color} ${TYPO.the}\n`,
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path)).toStrictEqual(['.gspot/config/typos.toml']);
    for (const config of configs) {
        await Bun.write(join(sandbox.path, config.path), config.content);
        const policy = Bun.spawnSync(['typos', '--isolated', '--config', config.path, 'gspot.toml'], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(policy.exitCode, policy.stdout.toString() + policy.stderr.toString()).toBe(0);
        const result = Bun.spawnSync(
            ['typos', '--isolated', '--config', config.path, '--format', 'json', 'fixture.txt', 'neighbor.txt'],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
        expect(result.exitCode, result.stderr.toString()).toBe(2);
        const found = result.stdout
            .toString()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as Record<string, unknown>)
            .map((record) => ({ path: record['path'], line: record['line_num'], typo: record['typo'] }));
        expect(found).toHaveLength(3);
        expect(found).toStrictEqual(
            containingAll([
                { path: 'fixture.txt', line: 1, typo: TYPO.the },
                { path: 'neighbor.txt', line: 1, typo: TYPO.color },
                { path: 'neighbor.txt', line: 1, typo: TYPO.the },
            ]),
        );
    }
});

test('spelling locales and word allowances remain scoped in generated configurations at all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['spelling'],
            `[[scope]]\npath = "british"\n[scope.tools.typos]\nlocale = "en-gb"\nwords = [{ word = "${TYPO.the}", reason = "An imported name requires this exact spelling." }]\n[scope.tools.typos.extra]\nreason = "A upstream fixture retains an external label."\n[scope.tools.typos.extra.type.upstream]\nextend-glob = ["upstream.txt"]\n[scope.tools.typos.extra.type.upstream.extend-words]\nrecieve = "${TYPO.receive}"\n[[scope]]\npath = "british/child"\n`,
            'all',
        ),
        'sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/upstream.txt': `${TYPO.receive}\n`,
        'upstream.txt': `${TYPO.receive}\n`,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const configs = output.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/british/child/typos.toml',
        '.gspot/config/british/typos.toml',
        '.gspot/config/typos.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: The runs call typos with the same flags on a different configuration and file.
    const run = (config: string, path: string) =>
        Bun.spawnSync(['typos', '--config', config, '--format', 'brief', '--color', 'never', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const root = run('.gspot/config/typos.toml', 'sample.txt');
    expect(root.exitCode, root.stderr.toString()).toBe(2);
    expect(root.stdout.toString()).toContain(TYPO.color);
    expect(root.stdout.toString()).toContain(TYPO.the);
    const policy = run('.gspot/config/typos.toml', 'gspot.toml');
    expect(policy.exitCode, policy.stdout.toString() + policy.stderr.toString()).toBe(0);
    const foreign = run('.gspot/config/typos.toml', 'upstream.txt');
    expect(foreign.exitCode, foreign.stdout.toString() + foreign.stderr.toString()).toBe(2);
    expect(foreign.stdout.toString()).toContain(TYPO.receive);
    const upstream = run('.gspot/config/british/child/typos.toml', 'british/child/upstream.txt');
    expect(upstream.exitCode, upstream.stdout.toString() + upstream.stderr.toString()).toBe(0);
    const child = run('.gspot/config/british/child/typos.toml', 'british/child/sample.txt');
    expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    const corrected = run('.gspot/config/typos.toml', 'sample.txt');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
});

test.each([
    ['nested/src/**'],
    ['**/src/**'],
    ['*.txt', '!**/keep.txt'],
    ['{nested/src,other/lib}/**'],
    ['nested/[st]rc/**'],
    ['/nested/src/'],
    ['nested'],
    ['**/nested/**/src/*'],
])('spelling exclusions %j report the same files in a scope configuration', async (...patterns) => {
    await using sandbox = await testdir();
    const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            kits: ['spelling'],
            tools: { typos: { exclude: [{ paths: patterns, reason: 'Generated input is checked by its owner.' }] } },
            scope: [{ path: 'nested' }, { path: 'nested/child' }],
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `${TYPO.the}\n`])),
    });
    const session = await openSession(sandbox.path);
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('typos.toml'));
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    const [root, scope] = ['.gspot/config/typos.toml', '.gspot/config/nested/typos.toml'].map((config) => {
        const result = Bun.spawnSync(
            [
                'typos',
                '--isolated',
                '--config',
                config,
                '--force-exclude',
                '--format',
                'json',
                ...paths.map((path) => `nested/${path}`),
            ],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
        expect([0, 2]).toContain(result.exitCode);
        return result.stdout
            .toString()
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => (JSON.parse(line) as { path: string }).path)
            .toSorted((left, right) => left.localeCompare(right));
    });
    expect(scope).toStrictEqual(root);
});
