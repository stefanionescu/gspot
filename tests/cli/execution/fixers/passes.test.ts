import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { TEXT_FIX, TEXT_CHECK } from '#tests/config/cli/execution/fixers-passes.ts';

test('fix verification replaces read source bytes and preserves unrelated authored files', async () => {
    await using sandbox = await testdir();
    const policy = `configurations = ["sql"]
[tools.sqlfluff]
dialect = "postgres"
[[check]]
name = "project/correct-sql"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
paths = ["query.sql"]
stage = "commit"
fix = [${JSON.stringify(process.execPath)}, "correct.cjs", "{files}"]
[check.output]
format = "none"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'query.sql': 'select from;\n',
        'notes.txt': 'Authored notes.\n',
        'correct.cjs': String.raw`const fs = require("node:fs"); for (const path of process.argv.slice(2)) fs.writeFileSync(path, "select 1;\n");`,
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['sql/syntax', 'project/correct-sql'] });
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode).toBe(1);
    expect(defect.report.checks.flatMap((check) => check.findings)).toContainEqual(
        containing({ file: 'query.sql', line: 1 }),
    );
    const corrected = await executeRun(session, { ...options, fix: true });
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual([
        { check: 'sql/syntax', status: 'passed', findings: [] },
        { check: 'project/correct-sql', status: 'passed', findings: [] },
    ]);
    expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe('select 1;\n');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    expect(await Bun.file(join(sandbox.path, 'notes.txt')).text()).toBe('Authored notes.\n');
});

test('a later pass formats what a correction after the formatter wrote', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'var x\n',
        'gspot.toml': `configurations = []
[[check]]
name = "project/format"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, '  ', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, '  ', ' ', '{files}'])}
[[check]]
name = "project/codemod"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', TEXT_CHECK, 'var', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', TEXT_FIX, 'var', 'let ', '{files}'])}
`,
    });
    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/format', 'project/codemod'] });
    const outcome = await executeRun(await openSession(sandbox.path), options);
    expect(outcome.report.exitCode, JSON.stringify(outcome.report.checks)).toBe(0);
    expect(outcome.fixes?.results).toMatchObject([
        { check: 'project/format', status: 'changed', changed: ['source.txt'] },
        { check: 'project/codemod', status: 'changed', changed: ['source.txt'] },
    ]);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('let x\n');
});

test('a fixer that fails midway leaves the later fixers to run in order and keep their edits', async () => {
    const entries = ['first', 'second', 'third'].map((name, index) => {
        const script = String.raw`const fs = require('node:fs'); fs.appendFileSync('order.log', '${name}\n'); fs.writeFileSync('${name}.txt', 'fixed\n'); process.exitCode = ${index === 0 ? '3' : '0'};`;
        return `[[check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}\nfix = ${JSON.stringify([process.execPath, '-e', script])}\npaths = ["${name}.txt"]\nstage = "commit"\n`;
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = []\n${entries.join('')}`,
        'first.txt': 'original\n',
        'second.txt': 'original\n',
        'third.txt': 'original\n',
    });
    const fixed = await runGspot(sandbox.path, [
        'check',
        '--only',
        'sandbox/first',
        'sandbox/second',
        'sandbox/third',
        '--fix',
        '--json',
    ]);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect((JSON.parse(fixed.stdout) as RunReport).failed).toStrictEqual(['sandbox/first']);
    // A second pass reruns the fixers whose files the first pass changed; the failed fixer does not run again.
    expect(readFileSync(join(sandbox.path, 'order.log'), 'utf8')).toBe('first\nsecond\nthird\nsecond\nthird\n');
    for (const name of ['first', 'second', 'third'])
        expect(readFileSync(join(sandbox.path, `${name}.txt`), 'utf8')).toBe('fixed\n');
});

test('checks refresh the file inventory after a fixer creates a source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.txt': 'input',
        'gspot.toml': `configurations = []
[[check]]
name = "project/inventory"
stage = "commit"
paths = ["*.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = process.argv.includes("added.txt") ? 0 : 1', '{files}'])}
fix = ${JSON.stringify([process.execPath, '-e', 'await Bun.write("added.txt", "created")'])}
`,
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/inventory'] });
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks[0]!.fileCount).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toContain('added.txt');
});
