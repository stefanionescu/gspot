import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';
import { QUALITY_FIX, QUALITY_COMMAND } from '#tests/data/commands/check/run.ts';

test('an aborted run stops its command and reports cancellation on every system', async () => {
    await using sandbox = await testdir();
    const marker = join(sandbox.path, 'command-ready');
    const program = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[command_check]]\nid = "project/cancel"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify([process.execPath, '-e', program])}\n`,
        }),
        'source.txt': 'Input.\n',
    });
    const controller = new AbortController();
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['project/cancel'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort();
    const result = await running;
    expect(result.report.checks).toMatchObject([{ check: 'project/cancel', status: 'error' }]);
    expect(result.report.checks[0]?.note).toBe(`${process.execPath} was canceled.`);
    await waitForExit(Number(await readFile(marker, 'utf8')));
});
test('a path ignore keeps the check and its fixer off those paths, and a run of only ignored paths is skipped', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings([], {
        tables: `[[command_check]]\nid = "project/quality"\ncommand = ${JSON.stringify(QUALITY_COMMAND)}\nfix = ${JSON.stringify(QUALITY_FIX)}\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\nreason = "The skipped input preserves the sample."\n`,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const commandArguments = ['check', '--only', 'project/quality', '--fix', '--json'];
    const corrected = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const report = corrected.report;
    expect(report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
    // A second correction pass reruns the fixer over the files the first pass changed.
    for (const log of ['checked.txt', 'fixed.txt']) {
        const entries = await readFile(join(sandbox.path, log), 'utf8');
        for (const line of entries.trim().split('\n'))
            expect((JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
                'inputs/regular.txt',
                'inputs/skip-keep.txt',
            ]);
    }
    expect(await readFile(join(sandbox.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
    const checked = await readFile(join(sandbox.path, 'checked.txt'), 'utf8');
    const fixed = await readFile(join(sandbox.path, 'fixed.txt'), 'utf8');
    const skipped = parseCheckReport(await runGspot(sandbox.path, [...commandArguments, '--', 'inputs/skip café.txt']));
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const skippedReport = skipped.report;
    expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', cause: 'ignore', findings: [] });
    expect(await readFile(join(sandbox.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(await readFile(join(sandbox.path, 'fixed.txt'), 'utf8')).toBe(fixed);
});
test('a path ignore covers its own paths, not the scopes below or beside it', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash'], {
        tables: '[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["root.sh"]\nreason = "The root script owns process cleanup."\n[[ignore]]\ncheck = "bash/safety"\nrule = "recursive-remove"\npaths = ["app/cleanup.sh"]\nreason = "The application script owns process cleanup."\n',
        scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'sibling' }],
    });
    const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const command = ['check', '--only', 'bash/safety', '--json'];
    const broken = parseCheckReport(await runGspot(sandbox.path, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        matchFields({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
    ]);
    for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
        await writeFile(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('an ignore with names keeps them in the run report and in the verbose ignore line', async () => {
    const reason = 'The framework calls this function by name.';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[[ignore]]\ncheck = "structure/trivial-functions"\nnames = ["use_thing"]\nreason = "${reason}"\n`,
        }),
        'hooks.py': 'def use_thing():\n    return 1\n',
    });
    commitAll(sandbox.path);
    const only = ['check', '--only', 'structure/trivial-functions'];
    const structured = parseCheckReport(await runGspot(sandbox.path, [...only, '--json']));
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.report.ignores).toStrictEqual([
        { check: 'structure/trivial-functions', names: ['use_thing'], reason },
    ]);
    const text = await runGspot(sandbox.path, [...only, '--verbose']);
    expect(text.stdout).toContain(`ignore     structure/trivial-functions names use_thing  ${reason}\n`);
});
