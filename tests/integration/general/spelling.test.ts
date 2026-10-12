import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { TYPO, SPELLING_EXCLUSIONS } from '#tests/config/spelling.ts';
import { sandboxPath, installToolProjects } from '#tests/setup/install.ts';
import { containing, containingAll, textContaining } from '#tests/setup/matchers.ts';

test('typos file-type word allowances apply only to their files at level all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['spelling'], {
            level: 'all',
            tables: `[tools.typos.extra]
reason = "The imported sample needs its original spelling."
value = { type = { fixture = { extend-glob = ["fixture.txt"], extend-words = { ${TYPO.color} = "${TYPO.color}" }, extend-identifiers = { IIFEs = "IIFEs" } } } }
`,
        }),
        'fixture.txt': `${TYPO.color} ${TYPO.the}\nIIFEs\n`,
        'neighbor.txt': `${TYPO.color} ${TYPO.the}\n`,
    });
    await installToolProjects(sandbox.path);
    const environment = { PATH: sandboxPath() };
    const failed = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(findings).toHaveLength(3);
    expect(findings).toStrictEqual(
        containingAll([
            containing({ file: 'fixture.txt', line: 1, message: textContaining(TYPO.the) }),
            containing({ file: 'neighbor.txt', line: 1, message: textContaining(TYPO.color) }),
            containing({ file: 'neighbor.txt', line: 1, message: textContaining(TYPO.the) }),
        ]),
    );
    await Bun.write(join(sandbox.path, 'fixture.txt'), `${TYPO.color} the\nIIFEs\n`);
    await Bun.write(join(sandbox.path, 'neighbor.txt'), 'color the\n');
    const fixed = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test('typos locale and word allowances stay in their scope at level all', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['spelling'], {
            level: 'all',
            tables: `[[scope]]
path = "british"
[scope.spelling]
locale = "en-gb"
[scope.tools.typos.extra]
reason = "Imported names keep their original spelling."
value = { default = { extend-words = { ${TYPO.the} = "${TYPO.the}" }, extend-identifiers = { ${TYPO.the} = "${TYPO.the}" } }, type = { upstream = { extend-glob = ["upstream.txt"], extend-words = { ${TYPO.receive} = "${TYPO.receive}" } } } }
[[scope]]
path = "british/child"
`,
        }),
        'sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/upstream.txt': `${TYPO.receive}\n`,
        'upstream.txt': `${TYPO.receive}\n`,
    });
    await installToolProjects(sandbox.path);
    const environment = { PATH: sandboxPath() };
    const checked = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'sample.txt',
        'sample.txt',
        'upstream.txt',
    ]);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    await Bun.write(join(sandbox.path, 'upstream.txt'), 'receive\n');
    const fixed = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test.each([...SPELLING_EXCLUSIONS])(
    'spelling ignore paths $patterns exclude the same files in the root and scope tool files',
    async ({ patterns, expected }) => {
        await using sandbox = await testdir();
        const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
        await createFileTree(sandbox.path, {
            'gspot.toml': stringify({
                configurations: ['spelling'],
                ignore: [
                    {
                        check: 'spelling/typos',
                        paths: patterns,
                        reason: 'These imported files keep their original spelling.',
                    },
                ],
                scope: [{ path: 'nested' }, { path: 'nested/child' }],
            }),
            ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `${TYPO.the}\n`])),
        });
        await installToolProjects(sandbox.path);
        const environment = { PATH: sandboxPath() };
        const checked = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
        const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(
            findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual([...expected]);
    },
);

test('typos JSON keeps file name delimiters, Unicode columns, and forbidden words without a fix', async () => {
    await using sandbox = await testdir();
    const paths = ['space name.txt', `${TYPO.the}.txt`, ...(isWindows ? [] : ['name:part.txt'])];
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['spelling'], {
            tables: `[tools.typos.extra]
reason = "The test checks a forbidden word."
value = { default = { extend-words = { forbidden = "" } } }
`,
        }),
        'nested/word.txt': 'forbidden\n',
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    });
    await installToolProjects(sandbox.path);
    const environment = { PATH: sandboxPath() };
    const checked = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = (JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings);
    for (const path of paths)
        expect(findings).toContainEqual(containing({ file: `nested/${path}`, line: 1, column: 6, fixable: true }));
    expect(findings).toStrictEqual(
        containingAll([
            containing({
                file: `nested/${TYPO.the}.txt`,
                message: `Filename: \`${TYPO.the}\` should be \`the\``,
                fixable: false,
            }),
            containing({
                file: 'nested/word.txt',
                line: 1,
                column: 1,
                fixable: false,
                message: '`forbidden` is not allowed',
            }),
        ]),
    );
    for (const path of paths) await Bun.write(join(sandbox.path, 'nested', path), 'café the\n');
    await Bun.write(join(sandbox.path, 'nested/word.txt'), 'permitted\n');
    await rename(join(sandbox.path, 'nested', `${TYPO.the}.txt`), join(sandbox.path, 'nested/the.txt'));
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'spelling/typos', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
