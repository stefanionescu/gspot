import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { isWindows } from '#tests/setup/system/platform.ts';
import { TYPO } from '#tests/config/checks/general/spelling.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges, changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';

import {
    SPELLING_SANDBOX,
    SPELLING_IGNORE_CASES,
    SPELLING_LOCALE_SETTINGS,
    SPELLING_CHECK_ARGUMENTS,
} from '#tests/config/integration/checks/general/spelling.ts';

const installedSandbox = shareInstalledSandbox(SPELLING_SANDBOX);

test('typos uses the spelling locale of each scope at level all', async () => {
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['spelling'], SPELLING_LOCALE_SETTINGS),
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
    'spelling ignore paths $patterns exclude the same files in the root and scope config files',
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
        buildSandboxChanges(SPELLING_SANDBOX.files, sourceFiles),
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
// typos needs an explicit option to keep exclusions for paths from the command line.
test('typos keeps its excluded paths for a file named on the command line', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        check: 'spelling/typos',
        files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
    });

    const excluded = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'], environment),
    );

    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);

    expect(excluded.report.checks).toMatchObject([{ check: 'spelling/typos', status: 'passed', fileCount: 1 }]);
});
