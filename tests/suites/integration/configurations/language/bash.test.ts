import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { compareText } from '#cli/system/text/order.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { parseCommandFindings } from '#cli/engine/run/tool-runs/output.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const DIALECT_SOURCES = {
    'posix.sh': String.raw`#!/bin/sh
if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'fallback.sh': String.raw`if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
    'app/posix.sh': String.raw`#!/bin/sh
if [[ -n "$1" ]]; then
    printf "%s\n" "$1"
fi
`,
} as const;

const DIALECT_FIXES = {
    ...DIALECT_SOURCES,
    'posix.sh': String.raw`#!/bin/sh
if [ -n "$1" ]; then
    printf "%s\n" "$1"
fi
`,
    'app/posix.sh': String.raw`#!/bin/sh
if [ -n "$1" ]; then
    printf "%s\n" "$1"
fi
`,
} as const;

const SHELLCHECK_DIALECT_FINDINGS = [
    { file: 'app/posix.sh', rule: 'SC3010' },
    { file: 'posix.sh', rule: 'SC3010' },
] as const;

const SYNTAX_FILES = {
    'script.sh': 'echo example\n',
    launcher: '#!/usr/bin/env -S bash -e\necho example\n',
    'script.zsh': 'repeat 2 do print example; done\n',
    zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
    'script.bats': `@test "example" {
    true
}
`,
} as const;

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

test('ShellCheck reports dialect findings by shebang', async () => {
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
    await createFileTree(sandbox.path, DIALECT_FIXES);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        corrected.report.checks
            .filter(({ check }) => check === 'bash/shellcheck')
            .map(({ scope, status, fileCount, findings }) => ({ scope, status, fileCount, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', fileCount: 2, findings: [] },
        { scope: 'app', status: 'passed', fileCount: 1, findings: [] },
    ]);
});

test('partial ShellCheck output beside an unreadable file gives a note that names the file', async () => {
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

test.skipIf(isWindows)('bash/zsh-syntax accepts clean files and reports a syntax error in script.zsh', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        ...SYNTAX_FILES,
    });

    await applyGeneratedFiles(sandbox.path);
    const command = ['check', '--only', 'bash/zsh-syntax', '--json'];
    const clean = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    expect(clean.report.checks).toMatchObject([{ status: 'passed', fileCount: 2, findings: [] }]);
    await writeFile(join(sandbox.path, 'script.zsh'), 'if then\n');
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks).toMatchObject([
        {
            check: 'bash/zsh-syntax',
            status: 'failed',
            findings: [{ file: 'script.zsh', line: 2, message: expect.stringContaining('parse error') as string }],
        },
    ]);
});

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
        name: 'the indent of a format override over the indent of every file',
        tables: '[format]\nindent_width = 2\n\n[[format.override]]\npaths = ["**/*.sh", "**/*.bash"]\nindent_width = 4\n',
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
