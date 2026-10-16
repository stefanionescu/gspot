import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system.ts';
import { stringify } from '@decimalturn/toml-patch';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { spawnCheckFindings } from '#tests/setup/run-gspot.ts';
import { matchItems, matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    TYPO,
    SPELLING_EXCLUSIONS,
    SPELLING_CHECK_ARGUMENTS,
    CHECKS_SPELLING_INSTALLED_SANDBOX,
} from '#tests/data/checks/spelling.ts';

const installedSandbox = registerSharedSandbox(CHECKS_SPELLING_INSTALLED_SANDBOX);

test('typos file-type word allowances apply only to their files at level all', async () => {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['spelling'], {
            level: 'all',
            tables: `[tools.typos.extra]
reason = "The imported sample needs its original spelling."
value = { type = { fixture = { extend-glob = ["fixture.txt"], extend-words = { ${TYPO.color} = "${TYPO.color}" }, extend-identifiers = { IIFEs = "IIFEs" } } } }
`,
        }),
        'fixture.txt': `${TYPO.color} ${TYPO.the}\nIIFEs\n`,
        'neighbor.txt': `${TYPO.color} ${TYPO.the}\n`,
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, sourceFiles),
    );
    const failed = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const findings = failed.findings;
    expect(findings).toHaveLength(3);
    expect(findings).toStrictEqual(
        matchItems([
            matchFields({ file: 'fixture.txt', line: 1, message: matchSubstring(TYPO.the) }),
            matchFields({ file: 'neighbor.txt', line: 1, message: matchSubstring(TYPO.color) }),
            matchFields({ file: 'neighbor.txt', line: 1, message: matchSubstring(TYPO.the) }),
        ]),
    );
    await Bun.write(join(sandbox.root, 'fixture.txt'), `${TYPO.color} the\nIIFEs\n`);
    await Bun.write(join(sandbox.root, 'neighbor.txt'), 'color the\n');
    const fixed = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test('typos locale and word allowances stay in their scope at level all', async () => {
    const sandbox = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['spelling'], {
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
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, sourceFiles),
    );
    const checked = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.findings;
    expect(findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'sample.txt',
        'sample.txt',
        'upstream.txt',
    ]);
    await Bun.write(join(sandbox.root, 'sample.txt'), 'color the\n');
    await Bun.write(join(sandbox.root, 'upstream.txt'), 'receive\n');
    const fixed = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test.each([...SPELLING_EXCLUSIONS])(
    'spelling ignore paths $patterns exclude the same files in the root and scope tool files',
    async ({ patterns, expected }) => {
        const sandbox = installedSandbox();
        const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
        const sourceFiles = {
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
        };
        await using _sourceChange = await applySandboxChanges(
            sandbox,
            buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, sourceFiles),
        );
        const checked = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
        const findings = checked.findings;
        expect(
            findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual([...expected]);
    },
);

test('typos JSON keeps file name delimiters, Unicode columns, and forbidden words without a fix', async () => {
    const sandbox = installedSandbox();
    const paths = ['space name.txt', `${TYPO.the}.txt`, ...(isWindows ? [] : ['name:part.txt'])];
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['spelling'], {
            tables: `[tools.typos.extra]
reason = "The test checks a forbidden word."
value = { default = { extend-words = { forbidden = "" } } }
`,
        }),
        'nested/word.txt': 'forbidden\n',
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    };
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, sourceFiles),
    );
    const checked = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.findings;
    for (const path of paths)
        expect(findings).toContainEqual(matchFields({ file: `nested/${path}`, line: 1, column: 6, fixable: true }));
    expect(findings).toStrictEqual(
        matchItems([
            matchFields({
                file: `nested/${TYPO.the}.txt`,
                message: `Filename: \`${TYPO.the}\` should be \`the\``,
                fixable: false,
            }),
            matchFields({
                file: 'nested/word.txt',
                line: 1,
                column: 1,
                fixable: false,
                message: '`forbidden` is not allowed',
            }),
        ]),
    );
    for (const path of paths) await Bun.write(join(sandbox.root, 'nested', path), 'café the\n');
    await Bun.write(join(sandbox.root, 'nested/word.txt'), 'permitted\n');
    await rename(join(sandbox.root, 'nested', `${TYPO.the}.txt`), join(sandbox.root, 'nested/the.txt'));
    const corrected = await spawnCheckFindings(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
