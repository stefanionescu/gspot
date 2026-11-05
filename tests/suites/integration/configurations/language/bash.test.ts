import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Glob } from 'bun';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { compareText } from '#cli/system/text.ts';
import {
    DIALECT_FIXES,
    DIALECT_SOURCES,
    SHELLCHECK_DIALECT_FINDINGS,
    SYNTAX_CASES,
    SYNTAX_FILES,
} from '#tests/config/integration/language.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

test('ShellCheck reports a finding in a filename that starts with a dash', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        '-f.sh': '#!/bin/sh\necho $1\n',
        'ok.sh': '#!/bin/sh\necho ok\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const result = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.report.checks).toMatchObject([
        { status: 'failed', fileCount: 2, findings: [{ file: '-f.sh', line: 2, rule: 'SC2086' }] },
    ]);
});

test.each([
    { level: 'basic', findings: [] },
    { level: 'all', findings: [{ file: 'deploy.sh', rule: 'SC2154' }] },
] as const)('ShellCheck at level $level skips the warnings that a bats file cannot avoid', async (row) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: row.level }),
        'deploy.sh': `#!/usr/bin/env bash\nprintf '%s\\n' "\${DEPLOY_TARGET}"\n`,
        'suite.bats': `#!/usr/bin/env bats

setup() {
  RESULT=ready
}

@test "changes the value" {
  NAME=changed
}

@test "reads the changed value" {
  run printf '%s\\n' "\${NAME}"
}

load_helper
load_helper() { :; }
`,
    });
    await applyGeneratedFiles(sandbox.path);
    const result = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(
        result.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([...row.findings]);
});

test('ShellCheck reports dialect findings by shebang and leaves source files unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', scopes: [{ path: 'app' }] }),
        ...DIALECT_SOURCES,
    });
    await applyGeneratedFiles(sandbox.path);
    const command = ['check', '--only', 'bash/shellcheck', '--json'];
    const checked = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks
            .flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))
            .toSorted((left, right) => compareText(left.file, right.file)),
    ).toStrictEqual([...SHELLCHECK_DIALECT_FINDINGS]);
    for (const [path, source] of Object.entries(DIALECT_SOURCES))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    await createFileTree(sandbox.path, DIALECT_FIXES);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        corrected.report.checks
            .filter(({ check }) => check === 'bash/shellcheck')
            .map(({ scope, status, fileCount, findings }) => ({ scope, status, fileCount, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', fileCount: 5, findings: [] },
        { scope: 'app', status: 'passed', fileCount: 2, findings: [] },
    ]);
});

test('the shell examples of the rule files pass ShellCheck', async () => {
    const folder = join(REPOSITORY_ROOT, 'packages/cli/src/configurations');
    const examples = [...new Glob('**/rules/*.md').scanSync(folder)].flatMap((path) =>
        listCodeFences(readFileSync(join(folder, path), 'utf8'))
            .filter(({ language }) => language === 'bash')
            .map(({ startLine, body }): [string, string] => [
                `examples/${path.replaceAll('/', '-')}-${String(startLine)}.sh`,
                `#!/usr/bin/env bash
# An example reads the names of a whole script.
# shellcheck disable=SC2034,SC2154
${body}
`,
            ]),
    );
    await using sandbox = await createGitSandbox({
        ...Object.fromEntries(examples),
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
    });
    await applyGeneratedFiles(sandbox.path);
    const result = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('partial ShellCheck output beside an unreadable file is an execution error', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.sh': '#!/usr/bin/env bash\necho $unquoted\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runBlockingCommand([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    const note = parseCommandFindings(planned, broken, paths, {}).note ?? '';
    expect(note).toContain('missing.sh');
});

test.skipIf(isWindows).each([...SYNTAX_CASES])(
    '$check accepts clean files and reports a syntax error in $path',
    async (row) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
            ...SYNTAX_FILES,
        });

        await applyGeneratedFiles(sandbox.path);
        const clean = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', row.check, '--json']));
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect(clean.report.checks).toMatchObject([{ status: 'passed', fileCount: row.files.length, findings: [] }]);
        const path = join(sandbox.path, row.path);
        await writeFile(path, row.broken);
        const broken = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', row.check, '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks).toMatchObject([
            {
                check: row.check,
                status: 'failed',
                findings: [
                    {
                        file: row.path,
                        line: row.line,
                        message: expect.stringContaining(row.message) as string,
                    },
                ],
            },
        ]);
    },
);

test('shfmt reports a syntax error as a finding and passes after the script is repaired', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'format']),
        'broken script.sh': BROKEN_IF_SCRIPT,
    });

    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await writeFile(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correction = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(correction.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test.each([
    {
        name: 'the case indent and simplify rules of the generated .editorconfig',
        tables: '',
        path: 'bin/release',
        source: '#!/usr/bin/env bash\ncount=1\ncase "$1" in\nup) printf "%s\\n" $(( $count + 1 )) ;;\nesac\n',
        fixed: '#!/usr/bin/env bash\ncount=1\ncase "$1" in\n    up) printf "%s\\n" $((count + 1)) ;;\nesac\n',
    },
    {
        name: 'tabs',
        tables: '[format]\nindent_style = "tab"\nindent_width = 4\n',
        path: 'bin/example',
        source: '#!/bin/sh\nif true; then\n  echo ready\nfi\n',
        fixed: '#!/bin/sh\nif true; then\n\techo ready\nfi\n',
    },
    {
        name: 'the indent of the .sh files over the indent of every file',
        tables: '[format]\nindent_width = 2\n',
        path: 'example.sh',
        source: 'if true; then\n    echo ready\nfi\ncase "$1" in\nup) echo up ;;\nesac\n',
        fixed: 'if true; then\n    echo ready\nfi\ncase "$1" in\n    up) echo up ;;\nesac\n',
    },
])('shfmt reports and fixes script formatting with $name', async ({ tables, path, source, fixed }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'format'], { tables }),
        [path]: source,
    });

    await applyGeneratedFiles(sandbox.path);
    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(broken.exitCode, JSON.stringify(broken)).toBe(1);
    const correction = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--fix'])).report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(fixed);
    const verified = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(verified.exitCode, JSON.stringify(verified)).toBe(0);
});
