import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/spelling.ts';
import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { changeSandbox, writeSandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    SPELLING_SANDBOX,
    SPELLING_IGNORE_CASES,
    SPELLING_LOCALE_SETTINGS,
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
    const typoFinding = { line: 1, column: 6, fixable: true, message: `\`${TYPO.the}\` should be \`the\`` };
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, fixable, message }) => ({ file, line, column, fixable, message })),
        ),
    ).toStrictEqual([
        ...(isWindows ? [] : [{ file: 'nested/name:part.txt', ...typoFinding }]),
        { file: 'nested/space name.txt', ...typoFinding },
        {
            file: `nested/${TYPO.the}.txt`,
            line: undefined,
            column: undefined,
            fixable: false,
            message: `Filename: \`${TYPO.the}\` should be \`the\``,
        },
        { file: `nested/${TYPO.the}.txt`, ...typoFinding },
    ]);
    const corrected = await runTyposCheck({
        'gspot.toml': sourceFiles['gspot.toml'],
        ...Object.fromEntries(paths.map((path) => [`nested/${path.replace(TYPO.the, 'the')}`, 'café the\n'])),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

async function runTyposCheck(files: Record<string, string>) {
    const sandbox = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(sandbox, buildSandboxChanges(SPELLING_SANDBOX.files, files));
    const checked = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', 'spelling/typos', '--json']));
    return {
        ...checked,
        files: checked.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file }) => file)
            .toSorted(compareText),
    };
}

test('typos keeps its excluded paths for a file named on the command line', async () => {
    const { root } = installedSandbox();
    await using _change = await changeSandbox(installedSandbox(), {
        files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
    });

    const excluded = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg']),
    );
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    expect(excluded.report.checks).toMatchObject([{ check: 'spelling/typos', status: 'passed', fileCount: 1 }]);
});
