import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { stringify } from '@decimalturn/toml-patch';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    TYPO,
    SPELLING_IGNORE_CASES,
    SPELLING_CHECK_ARGUMENTS,
    CHECKS_SPELLING_INSTALLED_SANDBOX,
} from '#tests/data/checks/spelling.ts';

const installedSandbox = registerSharedSandbox(CHECKS_SPELLING_INSTALLED_SANDBOX);

test('typos uses the spelling locale of each scope at level all', async () => {
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['spelling'], {
            level: 'all',
            tables: `[spelling]
locale = "en-us"
[[scope]]
path = "british"
[scope.spelling]
locale = "en-gb"
[[scope]]
path = "british/child"
`,
        }),
        'sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
        'british/child/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
    };
    const checked = await runTyposCheck(sourceFiles);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.files).toStrictEqual(['british/child/sample.txt', 'british/sample.txt', 'sample.txt', 'sample.txt']);
    const fixed = await runTyposCheck({
        ...sourceFiles,
        'sample.txt': 'color the\n',
        'british/sample.txt': 'colour the\n',
        'british/child/sample.txt': 'colour the\n',
    });
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test.each([...SPELLING_IGNORE_CASES])(
    'spelling ignore paths $patterns exclude the same files in the root and scope tool files',
    async ({ patterns, expected }) => {
        const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['spelling'], {
                rules: true,
                tables: stringify({
                    ignore: [
                        {
                            check: 'spelling/typos',
                            paths: patterns,
                            reason: 'These imported files keep their original spelling.',
                        },
                    ],
                    scope: [{ path: 'nested' }, { path: 'nested/child' }],
                }),
            }),
            ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `${TYPO.the}\n`])),
        };
        const checked = await runTyposCheck(sourceFiles);
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
        expect(checked.files).toStrictEqual([...expected]);
    },
);

test('typos reports Unicode columns in files whose names hold a space, a typo, or a colon', async () => {
    const paths = ['space name.txt', `${TYPO.the}.txt`, ...(isWindows ? [] : ['name:part.txt'])];
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['spelling']),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    };
    const checked = await runTyposCheck(sourceFiles);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.report.checks.flatMap(({ findings }) => findings);
    for (const path of paths)
        expect(findings).toContainEqual(matchFields({ file: `nested/${path}`, line: 1, column: 6, fixable: true }));
    expect(findings).toStrictEqual(
        matchItems([
            matchFields({
                file: `nested/${TYPO.the}.txt`,
                message: `Filename: \`${TYPO.the}\` should be \`the\``,
                fixable: false,
            }),
        ]),
    );
    const corrected = await runTyposCheck({
        'gspot.toml': sourceFiles['gspot.toml'],
        ...Object.fromEntries(paths.map((path) => [`nested/${path.replace(TYPO.the, 'the')}`, 'café the\n'])),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

/** Run typos against these files and list the reported paths in order. */
async function runTyposCheck(sourceFiles: Record<string, string>) {
    const sandbox = installedSandbox();
    await using _sourceChange = await applySandboxChanges(
        sandbox,
        buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, sourceFiles),
    );
    const checked = parseCheckReport(await spawnGspot(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment));
    return {
        ...checked,
        files: checked.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file }) => file)
            .toSorted((left, right) => left.localeCompare(right)),
    };
}
