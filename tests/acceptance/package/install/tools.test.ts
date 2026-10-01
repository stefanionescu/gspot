// Installs built packages from an isolated registry: private tool installation preserves authored metadata, and the
// installed formatter and native wrappers report defects and accept corrections.
import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { toPosix } from '#cli/platform/paths.ts';
import type { InstallJson } from '#cli/types/commands.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/package.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { createConsumer } from '#tests/support/package/consumer.ts';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { getPublishedRelease } from '#tests/support/package/published.ts';
import { prepareNativeConsumer, prepareFormatterConsumer } from '#tests/support/package/tools.ts';

const release = getPublishedRelease();

// A wrapped check reports its finding through the private tool folder, then passes on the corrected or fixed file.
async function expectWrappedCheck(
    command: string[],
    consumer: string,
    options: Parameters<typeof run>[1],
    check: { only: string; path: string; defect?: string; corrected?: string; finding: Record<string, unknown> },
): Promise<void> {
    const args = [...command, 'check', check.path, '--only', check.only, '--json'];
    if (check.defect !== undefined) writeFileSync(join(consumer, check.path), check.defect);
    const failed = await run(args, options);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const [checked] = (JSON.parse(failed.stdout) as RunReport).checks;
    expect(checked).toMatchObject({
        check: check.only,
        status: 'fail',
        findings: [{ file: check.path, ...check.finding }],
    });
    expect(toPosix(relative(realpathSync(consumer), checked!.command![0]!))).toStartWith('.gspot/node_modules/');
    if (check.corrected === undefined) {
        const fixed = await run([...args, '--fix'], options);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    } else writeFileSync(join(consumer, check.path), check.corrected);
    const passed = await run(args, options);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
}

test(
    'private installation keeps authored and locked metadata, and the installed formatter fixes source',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(fixture, release);
        const toolManifest = readFileSync(join(toolConsumer, '.gspot/package.json'));
        const toolLock = readFileSync(join(toolConsumer, '.gspot/bun.lock'));
        expect(toolLock.toString('utf8')).not.toContain(release.registry.url);
        expect(toolLock.toString('utf8')).not.toContain(release.registry.work);
        const preview = await run([...command, 'install', '--dry-run', '--json'], toolOptions);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InstallJson).isDryRun).toBe(true);
        // The planted mise is older than the runner pin, so install exits 2 after it installs the npm tools.
        const installed = await run([...command, 'install', '--json'], toolOptions);
        expect(installed.code, installed.stdout + installed.stderr).toBe(2);
        expect(readFileSync(join(toolConsumer, '.gspot/package.json'))).toStrictEqual(toolManifest);
        expect(readFileSync(join(toolConsumer, '.gspot/bun.lock'))).toStrictEqual(toolLock);
        const formatter = [...command, 'check', 'source.js', '--only', 'formatting/prettier', '--json'];
        const invalid = await run(formatter, toolOptions);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
            { check: 'formatting/prettier', status: 'fail', findings: [{ file: 'source.js' }] },
        ]);
        const fixed = await run([...formatter, '--fix'], toolOptions);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        const valid = await run(formatter, toolOptions);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed native wrappers report TOML and whitespace defects and accept corrections',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(fixture);
        await expectWrappedCheck(command, nativeConsumer, nativeOptions, {
            only: 'files/toml-format',
            path: 'settings.toml',
            finding: { fixable: true },
        });
        expect(readFileSync(join(nativeConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        await expectWrappedCheck(command, nativeConsumer, nativeOptions, {
            only: 'files/toml',
            path: 'settings.toml',
            defect: 'a = [\n',
            corrected: 'a = 1\n',
            finding: { line: 2, column: 1, fixable: false },
        });
        await expectWrappedCheck(command, nativeConsumer, nativeOptions, {
            only: 'formatting/editorconfig-checker',
            path: 'notes.json',
            corrected: '"text"\n',
            finding: { line: 1, fixable: false },
        });
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);
