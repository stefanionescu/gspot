import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { TypoEntry } from '#cli/types/parsers/output.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';

test('native spelling file-type allowances preserve unrelated findings and neighboring files at level all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['spelling'], {
            tables: `[reasons]\n"tools.typos.verbatim" = "The sample filename owns an external spelling; other words remain checked."\n[tools.typos.verbatim.type.fixture]\nextend-glob = ["fixture.txt"]\n[tools.typos.verbatim.type.fixture.extend-words]\ncolour = "${TYPO.color}"\n[tools.typos.verbatim.type.fixture.extend-identifiers]\nIIFEs = "IIFEs"\n`,
            level: 'all',
        }),
        'fixture.txt': `${TYPO.color} ${TYPO.the}\nIIFEs\n`,
        'neighbor.txt': `${TYPO.color} ${TYPO.the}\n`,
    });
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path)).toStrictEqual(['.gspot/config/typos.toml']);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitted, log);
    const policy = runTestCommandBlocking(
        ['typos', '--isolated', '--config', '.gspot/config/typos.toml', 'gspot.toml'],
        {
            cwd: sandbox.path,
        },
    );
    expect(policy.code, policy.stdout + policy.stderr).toBe(0);
    const result = runTestCommandBlocking(
        [
            'typos',
            '--isolated',
            '--config',
            '.gspot/config/typos.toml',
            '--format',
            'json',
            'fixture.txt',
            'neighbor.txt',
        ],
        { cwd: sandbox.path },
    );
    expect(result.code, result.stderr).toBe(2);
    const found = result.stdout
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
});

test('spelling locales and word allowances remain scoped in generated configurations at level all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['spelling'], {
            tables: `[scope."british"]\n[scope.british.prose]\nlocale = "en-gb"\n[scope.british.reasons]\n"tools.typos.verbatim" = "An imported name requires this exact spelling; an upstream sample retains an external label."\n[scope.british.tools.typos.verbatim.default.extend-words]\n"${TYPO.the}" = "${TYPO.the}"\n[scope.british.tools.typos.verbatim.default.extend-identifiers]\n"${TYPO.the}" = "${TYPO.the}"\n[scope.british.tools.typos.verbatim.type.upstream]\nextend-glob = ["upstream.txt"]\n[scope.british.tools.typos.verbatim.type.upstream.extend-words]\nrecieve = "${TYPO.receive}"\n[scope."british/child"]\n`,
            level: 'all',
        }),
        'sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/upstream.txt': `${TYPO.receive}\n`,
        'upstream.txt': `${TYPO.receive}\n`,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const configs = output.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/british/child/typos.toml',
        '.gspot/config/british/typos.toml',
        '.gspot/config/typos.toml',
    ]);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, output, log);

    const run = (config: string, path: string) =>
        runTestCommandBlocking(
            ['typos', '--isolated', '--config', config, '--format', 'brief', '--color', 'never', path],
            {
                cwd: sandbox.path,
            },
        );
    const root = run('.gspot/config/typos.toml', 'sample.txt');
    expect(root.code, root.stderr).toBe(2);
    expect(root.stdout).toContain(TYPO.color);
    expect(root.stdout).toContain(TYPO.the);
    const policy = run('.gspot/config/typos.toml', 'gspot.toml');
    expect(policy.code, policy.stdout + policy.stderr).toBe(0);
    const foreign = run('.gspot/config/typos.toml', 'upstream.txt');
    expect(foreign.code, foreign.stdout + foreign.stderr).toBe(2);
    expect(foreign.stdout).toContain(TYPO.receive);
    const upstream = run('.gspot/config/british/child/typos.toml', 'british/child/upstream.txt');
    expect(upstream.code, upstream.stdout + upstream.stderr).toBe(0);
    const parent = run('.gspot/config/british/typos.toml', 'british/sample.txt');
    expect(parent.code, parent.stdout + parent.stderr).toBe(0);
    const child = run('.gspot/config/british/child/typos.toml', 'british/child/sample.txt');
    expect(child.code, child.stdout + child.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    const corrected = run('.gspot/config/typos.toml', 'sample.txt');
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([
    [['nested/src/**']],
    [['**/src/**']],
    [['*.txt', '!**/keep.txt']],
    [['{nested/src,other/lib}/**']],
    [['nested/[st]rc/**']],
    [['/nested/src/']],
    [['nested']],
    [['**/nested/**/src/*']],
])('spelling exclusions %j report the same files in a scope configuration', async (patterns) => {
    await using sandbox = await testdir();
    const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['spelling'],
            ignore: [{ check: 'spelling/typos', paths: patterns, reason: 'Generated input is checked by its owner.' }],
            scope: { nested: {}, 'nested/child': {} },
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `${TYPO.the}\n`])),
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitAll(session), log);
    const selected = patterns.includes('nested')
        ? ['.gspot/config/typos.toml']
        : ['.gspot/config/typos.toml', '.gspot/config/nested/typos.toml'];
    const [root, scope] = selected.map((config) => {
        const result = runTestCommandBlocking(
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
            { cwd: sandbox.path },
        );
        expect([0, 2], result.stdout + result.stderr).toContain(result.code);
        return result.stdout
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => (JSON.parse(line) as Pick<TypoEntry, 'path'>).path)
            .toSorted((left, right) => left.localeCompare(right));
    });
    if (patterns.includes('nested')) {
        expect(root).toStrictEqual([]);
        expect(await pathExists(join(sandbox.path, '.gspot/config/nested/typos.toml'))).toBe(false);
    } else expect(scope).toStrictEqual(root);
});
