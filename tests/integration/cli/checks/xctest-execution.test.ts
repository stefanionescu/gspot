import { join } from 'node:path';
import { afterEach, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { rmSync, chmodSync, existsSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';

const caches = new Set<string>();
afterEach(() => {
    for (const folder of caches) rmSync(folder, { recursive: true, force: true });
    caches.clear();
});

const POLICY = `version = 1
configurations = ["xctest", "xcode"]
[limits]
tool_seconds = 1
[tools.xcode]
project = "Example.xcodeproj"
scheme = "Example"
[tools.xctest]
coverage = [{ target = "Example", percent = 80 }]
`;
const OPTIONS = {
    stage: 'push' as const,
    skips: [],
    only: ['xctest/coverage'],
    fix: false,
    isDryRun: false,
    noCache: true,
};
const script = (body: string): string => `#!${process.execPath}\n${body}\n`;

test.each(['no-project', 'failed-test', 'timeout', 'malformed', 'invalid-number', 'under-floor'])(
    'XCTest adapter preserves %s and accepts a corrected run',
    async (failure) => {
        await using sandbox = await testdir();
        caches.add(buildFolder(sandbox.path));
        await createFileTree(sandbox.path, {
            'gspot.toml':
                failure === 'no-project' ? POLICY.replace('project = "Example.xcodeproj"', 'project = ""') : POLICY,
            'ExampleTests.swift': 'import XCTest\n',
            'Example.xcodeproj/project.pbxproj': '',
            'node_modules/.bin/xcodebuild': script(
                failure === 'failed-test'
                    ? 'process.exitCode = 65;'
                    : failure === 'timeout'
                      ? 'await Bun.sleep(10_000);'
                      : '',
            ),
            'node_modules/.bin/xcrun': script(
                `await Bun.write('viewed.txt', 'viewed'); console.log(${JSON.stringify(failure === 'malformed' ? '{}' : JSON.stringify({ targets: [{ name: 'Example', lineCoverage: failure === 'invalid-number' ? 4 : failure === 'under-floor' ? 0.5 : 1 }] }))});`,
            ),
        });
        for (const tool of ['xcodebuild', 'xcrun']) chmodSync(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
        const outcome = await executeRun(await openSession(sandbox.path), OPTIONS);
        expect(outcome.report.exitCode).toBe(failure === 'under-floor' ? 1 : 2);
        expect(outcome.report.checks[0]!.status).toBe(failure === 'under-floor' ? 'fail' : 'error');
        expect(existsSync(join(sandbox.path, 'viewed.txt'))).toBe(false);
        const viewed = join(buildFolder(sandbox.path), 'swift/root/coverage/source/viewed.txt');
        // The coverage view is kept in the build folder whenever the run got as far as producing it.
        const produced = !['no-project', 'failed-test', 'timeout'].includes(failure);
        expect(existsSync(viewed) ? readFileSync(viewed, 'utf8') : undefined).toBe(produced ? 'viewed' : undefined);
        writeFileSync(join(sandbox.path, 'gspot.toml'), POLICY);
        writeFileSync(join(sandbox.path, 'node_modules/.bin/xcodebuild'), script(''));
        writeFileSync(
            join(sandbox.path, 'node_modules/.bin/xcrun'),
            script(
                `console.log(${JSON.stringify(JSON.stringify({ targets: [{ name: 'Example', lineCoverage: 1 }] }))});`,
            ),
        );
        const corrected = await executeRun(await openSession(sandbox.path), OPTIONS);
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'ok', findings: [] }]);
    },
);

test('XCTest coverage refuses an external result link and replaces a confined previous bundle', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const cache = join(buildFolder(sandbox.path), 'swift/root/coverage');
    caches.add(buildFolder(sandbox.path));
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'ExampleTests.swift': 'import XCTest\n',
        'Example.xcodeproj/project.pbxproj': '',
        'node_modules/.bin/xcodebuild': script(
            `const bundle = process.argv[process.argv.indexOf('-resultBundlePath') + 1]; if (await Bun.file(bundle + '/data/previous').exists()) throw new Error('Previous bundle survived'); await Bun.write('tested.txt', 'tested');`,
        ),
        'node_modules/.bin/xcrun': script(`console.log(JSON.stringify({targets:[{name:'Example',lineCoverage:1}]}));`),
    });
    for (const tool of ['xcodebuild', 'xcrun']) chmodSync(join(sandbox.path, 'node_modules/.bin', tool), 0o755);
    writeFileSync(join(outside.path, 'authored.txt'), 'preserved');
    mkdirSync(cache, { recursive: true });
    const bundle = join(cache, 'coverage.xcresult');
    symlinkSync(outside.path, bundle, process.platform === 'win32' ? 'junction' : 'dir');
    const refused = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(refused.report.exitCode).toBe(2);
    expect(readFileSync(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
    expect(existsSync(join(cache, 'source/tested.txt'))).toBe(false);
    rmSync(bundle);
    mkdirSync(join(bundle, 'data'), { recursive: true });
    writeFileSync(join(bundle, 'data/previous'), 'old result', { mode: 0o444 });
    const corrected = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
    expect(existsSync(bundle)).toBe(false);
    expect(readFileSync(join(cache, 'source/tested.txt'), 'utf8')).toBe('tested');
    expect(readFileSync(join(outside.path, 'authored.txt'), 'utf8')).toBe('preserved');
});
