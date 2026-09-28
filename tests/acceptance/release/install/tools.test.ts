// Installs built packages from an isolated registry: private tool installation preserves authored metadata and native wrappers run.
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';
import { reportSchema } from '#cli/execution/report.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/config/release.ts';
import { environment } from '#tests/support/release/packages.ts';
import { runProcess as run } from '#tests/support/cli/command.ts';
import type { InstallJson } from '#cli/types/commands/commands.ts';
import { createConsumer } from '#tests/support/release/consumer.ts';
import { getPublishedRelease } from '#tests/support/release/published.ts';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { prepareNativeConsumer, prepareFormatterConsumer } from '#tests/support/release/tools.ts';

const release = getPublishedRelease();

const formatterPackage = dirname(fileURLToPath(import.meta.resolve('prettier/package.json')));
const publishedFormatter = await run(
    ['npm', 'publish', formatterPackage, '--registry', release.registry.url, '--ignore-scripts'],
    {
        cwd: release.registry.work,
        env: { ...environment, NPM_CONFIG_USERCONFIG: release.registry.npmrc },
        timeoutMs: RELEASE_TIMEOUT_MS,
    },
);
if (publishedFormatter.code !== 0)
    throw new Error(`Formatter registry publication failed: ${publishedFormatter.stdout}${publishedFormatter.stderr}`);
test(
    'private installation preserves authored and locked metadata while reporting an outdated host runner',
    async () => {
        await using fixture = await createConsumer(release.registry, release.version);
        expect(fixture.installed.code, fixture.installed.stdout + fixture.installed.stderr).toBe(0);
        const { command } = fixture;
        const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterConsumer(fixture, release);
        expect(existsSync(join(toolConsumer, '.gspot/reports/report.json'))).toBe(false);
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
        const formatterArgs = ['check', 'source.js', '--only', 'formatting/prettier', '--no-cache', '--json'];
        const invalidFormat = await run([...command, ...formatterArgs], toolOptions);
        expect(invalidFormat.code, invalidFormat.stdout + invalidFormat.stderr).toBe(1);
        const formatReport = reportSchema.parse(JSON.parse(invalidFormat.stdout));
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
        expect(reportSchema.parse(JSON.parse(validFormat.stdout)).checks[0]).toMatchObject({
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
        const tomlFormat = [
            ...command,
            'check',
            'settings.toml',
            '--only',
            'files/toml-format',
            '--no-cache',
            '--json',
        ];
        const unformattedToml = await run(tomlFormat, nativeOptions);
        expect(unformattedToml.code, unformattedToml.stdout + unformattedToml.stderr).toBe(1);
        const tomlReport = reportSchema.parse(JSON.parse(unformattedToml.stdout));
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
        expect(
            relative(realpathSync(nativeConsumer), tomlReport.checks[0]!.command![0]!).replaceAll('\\', '/'),
        ).toStartWith('.gspot/node_modules/');
        const fixedToml = await run([...tomlFormat, '--fix'], nativeOptions);
        expect(fixedToml.code, fixedToml.stdout + fixedToml.stderr).toBe(0);
        expect(readFileSync(join(nativeConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        const formattedToml = await run(tomlFormat, nativeOptions);
        expect(formattedToml.code, formattedToml.stdout + formattedToml.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(formattedToml.stdout)).checks).toMatchObject([
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
        const tomlSyntax = [...command, 'check', 'settings.toml', '--only', 'files/toml', '--no-cache', '--json'];
        const invalidToml = await run(tomlSyntax, nativeOptions);
        expect(invalidToml.code, invalidToml.stdout + invalidToml.stderr).toBe(1);
        const syntaxReport = reportSchema.parse(JSON.parse(invalidToml.stdout));
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
        expect(reportSchema.parse(JSON.parse(validToml.stdout)).checks).toMatchObject([
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
            '--no-cache',
            '--json',
        ];
        const trailingWhitespace = await run(whitespaceCommand, nativeOptions);
        expect(trailingWhitespace.code, trailingWhitespace.stdout + trailingWhitespace.stderr).toBe(1);
        const whitespaceReport = reportSchema.parse(JSON.parse(trailingWhitespace.stdout));
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
        expect(
            relative(realpathSync(nativeConsumer), whitespaceReport.checks[0]!.command![0]!).replaceAll('\\', '/'),
        ).toStartWith('.gspot/node_modules/');
        writeFileSync(join(nativeConsumer, 'notes.json'), '"text"\n');
        const cleanWhitespace = await run(whitespaceCommand, nativeOptions);
        expect(cleanWhitespace.code, cleanWhitespace.stdout + cleanWhitespace.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(cleanWhitespace.stdout)).checks).toMatchObject([
            { check: 'formatting/editorconfig-checker', status: 'ok', files: 1, findings: [] },
        ]);
        expect(readFileSync(join(nativeConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);
