import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { testModules } from '#tests/harness/environment.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import * as toolRunner from '#cli/execution/command/runner.ts';
import { cachedBuild } from '#cli/checks/general/site/build.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { OUTPUT_CASES } from '#tests/config/cli/checks/general/site/output.ts';
import { brokenLinks, htmlValidate, deadSelectors } from '#cli/checks/general/site/output.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT, STATIC_SITE_FILES } from '#tests/config/samples/site.ts';

test.each([
    {
        name: 'links',
        analyze: (input: EngineInput) => brokenLinks(input, false),
        check: 'site/linkinator',
        body: '<a href="/missing.html">Missing</a>',
        finding: {
            check: 'site/linkinator',
            file: 'dist/index.html',
            rule: 'broken-link',
            line: 1,
            message: 'missing.html answers 404.',
        },
    },
    {
        name: 'markup',
        analyze: htmlValidate,
        check: 'site/html-validate',
        body: '<img src="image.png">',
        finding: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    },
    {
        name: 'selectors',
        analyze: deadSelectors,
        check: 'site/purgecss',
        body: '<p>Example</p>',
        finding: {
            file: 'dist/style.css',
            rule: 'dead-selector',
            line: 1,
            message: 'No built page uses the selector .unused.',
        },
    },
])('native $name output reports a defect and accepts its correction', async ({ analyze, check, body, finding }) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': SITE_BUILD_SCRIPT });
    const request = buildEngineInput(await openSession(sandbox.path), 'site/build-reproducible', {
        paths: ['build.js'],
        resources: resources,
    });
    request.spec = [...request.manifests.values()]
        .flatMap((manifest) => manifest.checks)
        .find((spec) => spec.name === check)!;
    const build = await cachedBuild(request);
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        '.gspot/config/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
    });
    writeFileSync(
        join(build.output, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`,
    );
    writeFileSync(join(build.output, 'style.css'), '.unused { color: red; }');
    const command = spyOn(toolRunner, 'runEngineTool').mockImplementation(async (_input, argv, options) =>
        processes.run([join(testModules, '.bin', argv[0]!), ...argv.slice(1)], {
            ...options,
            timeoutMs: 10_000,
        }),
    );
    try {
        const findings = await analyze(request);
        expect(findings).toMatchObject([finding]);
        writeFileSync(
            join(build.output, 'index.html'),
            `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>`,
        );
        expect(await analyze(request)).toStrictEqual([]);
    } finally {
        command.mockRestore();
    }
});

test.each(OUTPUT_CASES)('$check reports its built-output defect and accepts the correction', async (entry) => {
    const repository = { configurations: ['site'], files: STATIC_SITE_FILES, modules: false, installs: false };
    await using testRepository = await createTestRepository(repository, runGspot);
    const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, repository);
    expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
    expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(outcome.report.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
    expect(correction.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});
