import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { planRun } from '#cli/run/plan.ts';
import { createSandbox } from '@gspot/testing';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runEngineCheck } from '#cli/run/engines.ts';

const POLICY = 'version = 1\npresets = ["nextjs", "postgres", "xctest", "xcode", "static-site"]\n';
const WAITING = new Map([
    ['nextjs/build', 'tools.next.build_in_gate'],
    ['postgres/migration-docs', 'tools.postgres.migration_docs'],
    ['xctest/coverage', 'tools.xctest.coverage'],
    ['xcode/entitlements-policy', 'tools.xcode.allowed_entitlements'],
    ['static-site/size', 'tools.site.size_limits'],
]);

test('disabled settings produce skipped results and enabling a setting runs the check', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': POLICY,
        'Tests/ExampleTests.swift': 'import XCTest\nfinal class ExampleTests: XCTestCase {}\n',
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
        'page.html': '<!doctype html><html lang="en"><title>Example</title></html>',
    });
    const options = {
        stage: 'all' as const,
        skips: [],
        localSkips: [],
        only: WAITING.keys().toArray(),
        fix: false,
        isDryRun: false,
        noCache: true,
    };
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, options);
    expect(new Set(outcome.report.checks.map((check) => check.check))).toEqual(new Set(WAITING.keys()));
    for (const check of outcome.report.checks) {
        expect(check.status).toBe('skipped');
        expect(check.note).toContain(WAITING.get(check.check));
    }
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        POLICY + '[tools.xcode]\nallowed_entitlements = ["com.apple.security.app-sandbox"]\n',
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
    await using sandbox = await createSandbox({
        'gspot.toml':
            'version = 1\npresets = ["static-site"]\n[tools.site]\nbuild = "bun build.js"\nsize_limits = [{paths = ["**/*"], kb = 100}]\n',
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
    const planned = ['push', 'manual'].flatMap((stage) =>
        planRun(session, {
            stage: stage as 'push' | 'manual',
            skips: [],
            localSkips: [],
            only: ['static-site/build', ...consumers],
        }),
    );
    expect(planned).toHaveLength(consumers.size + 1);
    for (const check of planned) {
        const result = await runEngineCheck(session, check.spec.engine!, check);
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
    const [build] = planRun(next, { stage: 'push', skips: [], localSkips: [], only: ['static-site/build'] });
    const rebuilt = await runEngineCheck(next, build!.spec.engine!, build!);
    expect(rebuilt.status).toBe('ok');
});
