// Installs built packages from an isolated registry: private tool installation preserves authored metadata and native wrappers run.
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

test(
    'private installation preserves authored and locked metadata while reporting an outdated host runner',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(fixture, release);
        const toolManifest = readFileSync(join(toolConsumer, '.gspot/package.json'));
        const toolLock = readFileSync(join(toolConsumer, '.gspot/bun.lock'));
        expect(toolLock.toString('utf8')).not.toContain(release.registry.url);
        expect(toolLock.toString('utf8')).not.toContain(release.registry.work);
        const previewInstall = await run([...command, 'install', '--dry-run', '--json'], toolOptions);
        expect(previewInstall.code, previewInstall.stdout + previewInstall.stderr).toBe(0);
        expect((JSON.parse(previewInstall.stdout) as InstallJson).isDryRun).toBe(true);
        const toolInstall = await run([...command, 'install', '--json'], toolOptions);
        expect(toolInstall.code, toolInstall.stdout + toolInstall.stderr).toBe(2);
        expect((JSON.parse(toolInstall.stdout) as InstallJson).error).toContain('Install mise 2026.8.8 or newer');
        expect((JSON.parse(toolInstall.stdout) as InstallJson).error).toContain('installed locked npm tools');
        expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
        expect(readFileSync(join(toolConsumer, '.gspot/package.json'))).toStrictEqual(toolManifest);
        expect(readFileSync(join(toolConsumer, '.gspot/bun.lock'))).toStrictEqual(toolLock);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'privately installed formatters reject source, fix it, and accept the corrected bytes',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(fixture, release);
        const installed = await run([...command, 'install', '--json'], toolOptions);
        expect(installed.code, installed.stdout + installed.stderr).toBe(2);
        expect((JSON.parse(installed.stdout) as InstallJson).error).toContain('installed locked npm tools');
        const formatterArgs = ['check', 'source.js', '--only', 'formatting/prettier', '--json'];
        const invalidFormat = await run([...command, ...formatterArgs], toolOptions);
        expect(invalidFormat.code, invalidFormat.stdout + invalidFormat.stderr).toBe(1);
        const formatReport = JSON.parse(invalidFormat.stdout) as RunReport;
        expect(formatReport.skips).toStrictEqual([]);
        expect(formatReport.checks).toHaveLength(1);
        expect(formatReport.checks[0]).toMatchObject({
            check: 'formatting/prettier',
            status: 'fail',
            files: 1,
        });
        expect(
            formatReport.checks[0]!.findings.map(({ check, file, message: text }) => ({ check, file, message: text })),
        ).toStrictEqual([
            {
                check: 'formatting/prettier',
                file: 'source.js',
                message: 'This file is not formatted the way Prettier formats it.',
            },
        ]);
        const fixedFormat = await run([...command, ...formatterArgs, '--fix'], toolOptions);
        expect(fixedFormat.code, fixedFormat.stdout + fixedFormat.stderr).toBe(0);
        const validFormat = await run([...command, ...formatterArgs], toolOptions);
        expect(validFormat.code, validFormat.stdout + validFormat.stderr).toBe(0);
        expect((JSON.parse(validFormat.stdout) as RunReport).checks[0]).toMatchObject({
            status: 'ok',
            findings: [],
        });
        expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed TOML wrappers report formatting defects and correct the authored file',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(fixture);
        const tomlFormat = [...command, 'check', 'settings.toml', '--only', 'files/toml-format', '--json'];
        const unformattedToml = await run(tomlFormat, nativeOptions);
        expect(unformattedToml.code, unformattedToml.stdout + unformattedToml.stderr).toBe(1);
        const tomlReport = JSON.parse(unformattedToml.stdout) as RunReport;
        expect(tomlReport.skips).toStrictEqual([]);
        expect(tomlReport.checks).toHaveLength(1);
        expect(tomlReport.checks[0]).toMatchObject({
            check: 'files/toml-format',
            status: 'fail',
            files: 1,
        });
        expect(
            tomlReport.checks[0]!.findings.map(({ check, file, message: text, fixable }) => ({
                check,
                file,
                message: text,
                fixable,
            })),
        ).toStrictEqual([
            {
                check: 'files/toml-format',
                file: 'settings.toml',
                message: 'The file is not formatted with the configured TOML settings.',
                fixable: true,
            },
        ]);
        expect(toPosix(relative(realpathSync(nativeConsumer), tomlReport.checks[0]!.command![0]!))).toStartWith(
            '.gspot/node_modules/',
        );
        const fixedToml = await run([...tomlFormat, '--fix'], nativeOptions);
        expect(fixedToml.code, fixedToml.stdout + fixedToml.stderr).toBe(0);
        expect(readFileSync(join(nativeConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        const formattedToml = await run(tomlFormat, nativeOptions);
        expect(formattedToml.code, formattedToml.stdout + formattedToml.stderr).toBe(0);
        expect((JSON.parse(formattedToml.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/toml-format', status: 'ok', files: 1, findings: [] },
        ]);
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed TOML wrappers report exact syntax findings and accept corrected input',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(fixture);
        writeFileSync(join(nativeConsumer, 'settings.toml'), 'a = [\n');
        const tomlSyntax = [...command, 'check', 'settings.toml', '--only', 'files/toml', '--json'];
        const invalidToml = await run(tomlSyntax, nativeOptions);
        expect(invalidToml.code, invalidToml.stdout + invalidToml.stderr).toBe(1);
        const syntaxReport = JSON.parse(invalidToml.stdout) as RunReport;
        expect(syntaxReport.skips).toStrictEqual([]);
        expect(syntaxReport.checks).toHaveLength(1);
        expect(syntaxReport.checks[0]).toMatchObject({ check: 'files/toml', status: 'fail', files: 1 });
        expect(
            syntaxReport.checks[0]!.findings.map(({ check, file, line, column, message: text, fixable }) => ({
                check,
                file,
                line,
                column,
                message: text,
                fixable,
            })),
        ).toStrictEqual([
            {
                check: 'files/toml',
                file: 'settings.toml',
                line: 2,
                column: 1,
                message: 'The file does not parse as TOML.',
                fixable: false,
            },
        ]);
        writeFileSync(join(nativeConsumer, 'settings.toml'), 'a = 1\n');
        const validToml = await run(tomlSyntax, nativeOptions);
        expect(validToml.code, validToml.stdout + validToml.stderr).toBe(0);
        expect((JSON.parse(validToml.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/toml', status: 'ok', files: 1, findings: [] },
        ]);
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed whitespace wrappers report exact findings and accept corrected input',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { nativeConsumer, nativeOptions, authoredPackage } = await prepareNativeConsumer(fixture);
        const whitespaceCommand = [
            ...command,
            'check',
            'notes.json',
            '--only',
            'formatting/editorconfig-checker',
            '--json',
        ];
        const trailingWhitespace = await run(whitespaceCommand, nativeOptions);
        expect(trailingWhitespace.code, trailingWhitespace.stdout + trailingWhitespace.stderr).toBe(1);
        const whitespaceReport = JSON.parse(trailingWhitespace.stdout) as RunReport;
        expect(whitespaceReport.skips).toStrictEqual([]);
        expect(whitespaceReport.checks).toHaveLength(1);
        expect(whitespaceReport.checks[0]).toMatchObject({
            check: 'formatting/editorconfig-checker',
            status: 'fail',
            files: 1,
        });
        expect(
            whitespaceReport.checks[0]!.findings.map(({ check, file, line, message: text, fixable }) => ({
                check,
                file,
                line,
                message: text,
                fixable,
            })),
        ).toStrictEqual([
            {
                check: 'formatting/editorconfig-checker',
                file: 'notes.json',
                line: 1,
                message: 'Trailing whitespace',
                fixable: false,
            },
        ]);
        expect(toPosix(relative(realpathSync(nativeConsumer), whitespaceReport.checks[0]!.command![0]!))).toStartWith(
            '.gspot/node_modules/',
        );
        writeFileSync(join(nativeConsumer, 'notes.json'), '"text"\n');
        const cleanWhitespace = await run(whitespaceCommand, nativeOptions);
        expect(cleanWhitespace.code, cleanWhitespace.stdout + cleanWhitespace.stderr).toBe(0);
        expect((JSON.parse(cleanWhitespace.stdout) as RunReport).checks).toMatchObject([
            { check: 'formatting/editorconfig-checker', status: 'ok', files: 1, findings: [] },
        ]);
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);
