import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { CHECKS } from '#cli/checks/registry.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { SITE_CONSUMERS } from '#tests/config/cli/execution/prerequisites.ts';

test('a missing required setting skips its check', async () => {
    const policy = buildPolicy(['xcode'], { level: 'all' });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
    });
    const options = buildRunOptions({ only: ['xcode/entitlements'] });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, options);
    expect(outcome.report.checks).toMatchObject([
        {
            check: 'xcode/entitlements',
            status: 'skipped',
            note: textContaining('tools.xcode.entitlements_allowed'),
        },
    ]);
});

test('a failed site build skips every output consumer and a new session rebuilds', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['site'], {
            tables: '[site]\nbuild = "bun build.js"\n[limits.site]\nkilobytes = [{paths = ["**/*"], kb = 100}]\n',
            level: 'all',
        }),
        'build.js': 'console.error("Test build failure"); process.exitCode = 1;',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const consumers = new Set(SITE_CONSUMERS);
    const session = await openSession(sandbox.path);
    session.resources = resources;
    const failed = await executeRun(session, buildRunOptions({ only: ['site/build', ...consumers] }));
    expect(failed.report.exitCode).toBe(1);
    expect(
        failed.report.checks
            .map((result) => ({
                check: result.check,
                status: result.status,
                note: result.note,
                message: result.findings[0]?.message,
            }))
            .toSorted((left, right) => left.check.localeCompare(right.check)),
    ).toMatchObject(
        [
            { check: 'site/build', status: 'failed', message: textContaining('Test build failure') },
            ...[...consumers].map((check) => ({ check, status: 'skipped', note: textContaining('did not build') })),
        ].toSorted((left, right) => left.check.localeCompare(right.check)),
    );
    writeFileSync(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path);
    next.resources = resources;
    const rebuilt = await executeRun(next, buildRunOptions({ only: ['site/build'] }));
    expect(rebuilt.report.exitCode).toBe(0);
    expect(rebuilt.report.checks).toMatchObject([{ check: 'site/build', status: 'passed', findings: [] }]);
});

// A runner that fails past its own handling, as a tool runner can.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The run registry takes a runner function, and this one stands for a runner that fails.
function brokenRunner(): Promise<never> {
    return Promise.reject(new Error('The runner broke'));
}

test('a check runner that throws errors that check alone, and the other checks keep their results', async () => {
    const reporter = [process.execPath, '-e', 'console.log("source.txt"); process.exitCode = 1;'];
    const entries = ['broken', 'kept'].map(
        (name) =>
            `[[check]]\nname = "sandbox/${name}"\ncommand = ${JSON.stringify(reporter)}\npaths = ["source.txt"]\nstage = "commit"\n[check.output]\nformat = "lines"\n`,
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: entries.join('') }),
        'source.txt': 'input\n',
    });
    const checks = { ...CHECKS, 'sandbox/broken': { run: brokenRunner } };
    const outcome = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({ checks, only: ['sandbox/broken', 'sandbox/kept'] }),
    );
    expect(outcome.report.exitCode).toBe(2);
    expect(outcome.report.checks).toMatchObject([
        { check: 'sandbox/broken', status: 'error', note: textContaining('The runner broke') },
        { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
    ]);
});
