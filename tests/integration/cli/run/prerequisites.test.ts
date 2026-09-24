import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { planRun } from '#cli/run/plan.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { resolveCheck } from '#cli/run/engines.ts';

const POLICY =
    'version = 1\nlevel = "all"\nconfigurations = ["nextjs", "postgres", "xctest", "xcode", "static-site"]\n';
const WAITING = new Map([
    ['nextjs/build', 'tools.next.build_in_gate'],
    ['postgres/migration-docs', 'tools.postgres.migration_docs'],
    ['xctest/coverage', 'tools.xctest.coverage'],
    ['xcode/entitlements-policy', 'tools.xcode.entitlements_allowed'],
    ['static-site/size', 'tools.site.size_limits'],
]);

test('disabled settings produce skipped results and enabling a setting runs the check', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'Tests/ExampleTests.swift': 'import XCTest\nfinal class ExampleTests: XCTestCase {}\n',
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        only: WAITING.keys().toArray(),
        fix: false,
        isDryRun: false,
        noCache: true,
    };
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, options);
    expect(new Set(outcome.report.checks.map((check) => check.check))).toStrictEqual(new Set(WAITING.keys()));
    expect(outcome.report.coverage.checked).toBe(0);
    for (const check of outcome.report.checks) {
        expect(check.status).toBe('skipped');
        expect(check.note).toContain(WAITING.get(check.check));
    }
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        POLICY + '[tools.xcode]\nentitlements_allowed = ["com.apple.security.app-sandbox"]\n',
    );
    const enabled = await executeRun(await openSession(sandbox.path), {
        ...options,
        only: ['xcode/entitlements-policy'],
    });
    expect(enabled.report.exitCode).toBe(1);
    expect(enabled.report.checks[0]?.status).toBe('fail');
    expect(enabled.report.checks[0]?.findings[0]?.message).toContain('aps-environment is not an allowed entitlement');
});

test('a failed site build skips every output consumer and a new session rebuilds', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["static-site"]\n[tools.site]\nbuild = "bun build.js"\nsize_limits = [{paths = ["**/*"], kb = 100}]\n',
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
    const planned = (
        await Promise.all(
            ['push', 'manual'].map((stage) =>
                planRun(session, {
                    stage: stage as 'push' | 'manual',
                    skips: [],
                    only: ['static-site/build', ...consumers],
                }),
            ),
        )
    ).flat();
    expect(planned).toHaveLength(consumers.size + 1);
    for (const check of planned) {
        const result = await resolveCheck(check.spec)(session, check);
        if (check.check === 'static-site/build') {
            expect(result.status).toBe('fail');
            expect(result.findings[0]?.message).toContain('Planted build failure');
        } else {
            expect(result.status).toBe('skipped');
            expect(result.note).toBe('The site did not build.');
        }
    }
    writeFileSync(
        join(sandbox.path, 'build.js'),
        'import {mkdirSync, writeFileSync} from "node:fs"; mkdirSync("dist"); writeFileSync("dist/index.html", "built");',
    );
    const next = await openSession(sandbox.path);
    next.resources = resources;
    const [build] = await planRun(next, { stage: 'push', skips: [], only: ['static-site/build'] });
    const rebuilt = await resolveCheck(build!.spec)(next, build!);
    expect(rebuilt.status).toBe('ok');
});
