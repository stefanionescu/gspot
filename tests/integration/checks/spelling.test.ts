import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { stringify } from '@decimalturn/toml-patch';
import { rename, writeFile } from 'node:fs/promises';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    TYPO,
    SPELLING_EXCLUSIONS,
    SPELLING_CHECK_ARGUMENTS,
    CHECKS_SPELLING_INSTALLED_SANDBOX,
} from '#tests/data/checks/spelling.ts';

const installedSandbox = registerSharedSandbox(CHECKS_SPELLING_INSTALLED_SANDBOX);

async function prepareSpellingCheck(sandbox: Sandbox, files: Record<string, string>) {
    await using resources = new AsyncDisposableStack();
    resources.use(
        await applySandboxChanges(sandbox, buildSandboxChanges(CHECKS_SPELLING_INSTALLED_SANDBOX.files, files)),
    );
    const checked = parseCheckReport(await spawnGspot(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment));
    return Object.assign(resources.move(), { checked });
}

test('typos uses the spelling locale of each scope at level all', async () => {
    const sandbox = installedSandbox();
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
    await using change = await prepareSpellingCheck(sandbox, sourceFiles);
    const { checked } = change;
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.report.checks.flatMap(({ findings }) => findings);
    expect(findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'british/child/sample.txt',
        'british/sample.txt',
        'sample.txt',
        'sample.txt',
    ]);
    await writeFile(join(sandbox.root, 'sample.txt'), 'color the\n');
    await writeFile(join(sandbox.root, 'british/sample.txt'), 'colour the\n');
    await writeFile(join(sandbox.root, 'british/child/sample.txt'), 'colour the\n');
    const fixed = parseCheckReport(await spawnGspot(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment));
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
});

test.each([...SPELLING_EXCLUSIONS])(
    'spelling ignore paths $patterns exclude the same files in the root and scope tool files',
    async ({ patterns, expected }) => {
        const sandbox = installedSandbox();
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
        await using change = await prepareSpellingCheck(sandbox, sourceFiles);
        const { checked } = change;
        expect(checked.code, checked.stdout + checked.stderr).toBe(expected.length === 0 ? 0 : 1);
        const findings = checked.report.checks.flatMap(({ findings }) => findings);
        expect(
            findings.map((finding) => finding.file).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual([...expected]);
    },
);

test('typos reports Unicode columns in files whose names hold a space, a typo, or a colon', async () => {
    const sandbox = installedSandbox();
    const paths = ['space name.txt', `${TYPO.the}.txt`, ...(isWindows ? [] : ['name:part.txt'])];
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['spelling']),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `café ${TYPO.the}\n`])),
    };
    await using change = await prepareSpellingCheck(sandbox, sourceFiles);
    const { checked } = change;
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
    for (const path of paths) await writeFile(join(sandbox.root, 'nested', path), 'café the\n');
    await rename(join(sandbox.root, 'nested', `${TYPO.the}.txt`), join(sandbox.root, 'nested/the.txt'));
    const corrected = parseCheckReport(await spawnGspot(sandbox.root, SPELLING_CHECK_ARGUMENTS, sandbox.environment));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
