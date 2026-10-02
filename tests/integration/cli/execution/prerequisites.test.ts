import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkExecution } from '#cli/execution/engines.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { textContaining } from '#tests/support/expectations.ts';

test('a disabled setting skips its check and enabling the setting runs it', async () => {
    const policy = policyOf(['xcode'], '', 'all');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: ['xcode/entitlements-policy'],
        fix: false,
        isDryRun: false,
    };
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, { ...options, checks: CHECKS });
    expect(outcome.report.checks).toMatchObject([
        {
            check: 'xcode/entitlements-policy',
            status: 'skipped',
            note: textContaining('tools.xcode.entitlements_allowed'),
        },
    ]);
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        policy + '[tools.xcode]\nentitlements_allowed = ["com.apple.security.app-sandbox"]\n',
    );
    const enabled = await executeRun(await openSession(sandbox.path), { ...options, checks: CHECKS });
    expect(enabled.report.exitCode).toBe(1);
    expect(enabled.report.checks[0]?.status).toBe('fail');
    expect(enabled.report.checks[0]?.findings[0]?.message).toContain('aps-environment is not an allowed entitlement');
});

test('a failed site build skips every output consumer and a new session rebuilds', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['static-site'],
            '[tools.site]\nbuild = "bun build.js"\nsize_limits = [{paths = ["**/*"], kb = 100}]\n',
            'all',
        ),
        'build.js': 'console.error("Planted build failure"); process.exitCode = 1;',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const consumers = new Set([
        'static-site/build-reproducible',
        'static-site/html-validate-built',
        'css/dead-selectors',
        'static-site/links-internal',
        'static-site/links-external',
        'static-site/size',
        'static-site/sitemap',
    ]);
    const session = await openSession(sandbox.path);
    session.resources = resources;
    const stages = ['push', 'manual'].map((stage) =>
        planRun(session, {
            stage: stage as 'push' | 'manual',
            skips: [],
            only: ['static-site/build', ...consumers],
        }),
    );
    const planned = stages.flat();
    expect(planned).toHaveLength(consumers.size + 1);
    // The build fails with its own output, and every check that reads the built site is skipped with one note.
    const outcomes: { check: string; status: string; note: string | undefined; message: string | undefined }[] = [];
    for (const check of planned) {
        const result = await checkExecution(check.spec, CHECKS)(session, check);
        outcomes.push({
            check: check.check,
            status: result.status,
            note: result.note,
            message: result.findings[0]?.message,
        });
    }
    expect(
        outcomes.toSorted((left: { check: string }, right: { check: string }) => left.check.localeCompare(right.check)),
    ).toMatchObject(
        [
            { check: 'static-site/build', status: 'fail', message: textContaining('Planted build failure') },
            ...[...consumers].map((check) => ({ check, status: 'skipped', note: 'The site did not build.' })),
        ].toSorted((left: { check: string }, right: { check: string }) => left.check.localeCompare(right.check)),
    );
    writeFileSync(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path);
    next.resources = resources;
    const [build] = planRun(next, { stage: 'push', skips: [], only: ['static-site/build'] });
    const rebuilt = await checkExecution(build!.spec, CHECKS)(next, build!);
    expect(rebuilt.status).toBe('ok');
});
