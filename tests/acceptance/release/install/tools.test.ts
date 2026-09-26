// Installs built packages from an isolated registry: private tool installation preserves authored metadata and native wrappers run.
import { fileURLToPath } from 'node:url';
import { reportSchema } from '#cli/execution/report.ts';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { delimiter, dirname, join, relative } from 'node:path';
import { runProcess as run } from '#tests/support/cli/command.ts';
import type { PublishedRelease } from '#tests/support/release/published.ts';
import { environment, RELEASE_TIMEOUT_MS } from '#tests/support/release/packages.ts';
import { installedConsumer, publishRelease } from '#tests/support/release/published.ts';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

let release: PublishedRelease;
beforeAll(async () => {
    release = await publishRelease();
}, RELEASE_TIMEOUT_MS);
afterAll(async () => {
    await release?.registry.stop();
});

test(
    'private installation preserves authored metadata when the host runner is outdated',
    async () => {
        await using fixture = await installedConsumer(release);
        const { command } = fixture;
        const formatterPackage = dirname(fileURLToPath(import.meta.resolve('prettier/package.json')));
        const publishedFormatter = await run(
            ['npm', 'publish', formatterPackage, '--registry', release.registry.url, '--ignore-scripts'],
            {
                cwd: release.registry.work,
                env: { ...environment, NPM_CONFIG_USERCONFIG: release.registry.npmrc },
                timeoutMs: RELEASE_TIMEOUT_MS,
            },
        );
        expect(publishedFormatter.code, publishedFormatter.stdout + publishedFormatter.stderr).toBe(0);
        const toolConsumer = join(fixture.workspace, 'tool-consumer');
        const hostTools = join(fixture.workspace, 'host-tools');
        mkdirSync(toolConsumer);
        mkdirSync(hostTools);
        writeFileSync(join(hostTools, 'mise'), '#!/bin/sh\nprintf "2026.5.15\\n"\n', { mode: 0o755 });
        const bun = await run(['bun', '--version'], {
            cwd: toolConsumer,
            env: environment,
            timeoutMs: RELEASE_TIMEOUT_MS,
        });
        expect(bun.code, bun.stdout + bun.stderr).toBe(0);
        const authoredPackage = JSON.stringify({
            private: true,
            packageManager: `bun@${bun.stdout.trim()}`,
            scripts: { test: 'authored-command' },
        });
        writeFileSync(join(toolConsumer, 'package.json'), authoredPackage);
        writeFileSync(join(toolConsumer, '.npmrc'), `registry=${release.registry.url}\n`);
        writeFileSync(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
        const toolOptions = {
            cwd: toolConsumer,
            timeoutMs: RELEASE_TIMEOUT_MS,
            env: {
                ...environment,
                CI: '1',
                NO_COLOR: '1',
                PATH: `${hostTools}${delimiter}${environment['PATH'] ?? ''}`,
                NPM_CONFIG_USERCONFIG: release.toolNpmrc,
                HTTP_PROXY: undefined,
                HTTPS_PROXY: undefined,
                ALL_PROXY: undefined,
                http_proxy: undefined,
                https_proxy: undefined,
                all_proxy: undefined,
                NO_PROXY: '127.0.0.1,localhost',
            },
        };
        const toolInit = await run(
            [
                ...command,
                'init',
                '--json',
                '--yes',
                '--configurations',
                'formatting',
                '--runner',
                'mise',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ],
            toolOptions,
        );
        expect(toolInit.code, toolInit.stdout + toolInit.stderr).toBe(0);
        expect(existsSync(join(toolConsumer, '.gspot/reports/report.json'))).toBe(false);
        const selectedFormatter = await run([...command, 'set', 'extra_checks', 'formatting/prettier'], toolOptions);
        expect(selectedFormatter.code, selectedFormatter.stdout + selectedFormatter.stderr).toBe(0);
        const toolManifest = readFileSync(join(toolConsumer, '.gspot/package.json'));
        const toolLock = readFileSync(join(toolConsumer, '.gspot/bun.lock'));
        expect(toolLock.toString('utf8')).not.toContain(release.registry.url);
        expect(toolLock.toString('utf8')).not.toContain(release.registry.work);
        const previewInstall = await run([...command, 'install', '--dry-run', '--json'], toolOptions);
        expect(previewInstall.code, previewInstall.stdout + previewInstall.stderr).toBe(0);
        expect(JSON.parse(previewInstall.stdout).isDryRun).toBe(true);
        const toolInstall = await run([...command, 'install', '--json'], toolOptions);
        expect(toolInstall.code, toolInstall.stdout + toolInstall.stderr).toBe(2);
        expect(JSON.parse(toolInstall.stdout).error).toContain('Install mise 2026.8.8 or newer');
        expect(JSON.parse(toolInstall.stdout).error).toContain('installed locked npm tools');
        expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
        expect(readFileSync(join(toolConsumer, '.gspot/package.json'))).toStrictEqual(toolManifest);
        expect(readFileSync(join(toolConsumer, '.gspot/bun.lock'))).toStrictEqual(toolLock);
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
            formatReport.checks[0]!.findings.map(({ check, file, message }) => ({ check, file, message })),
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
    'installed native wrappers report and correct TOML and whitespace defects',
    async () => {
        await using fixture = await installedConsumer(release);
        const { command, setupOptions } = fixture;
        const authoredPackage = JSON.stringify({ private: true, scripts: { test: 'authored-command' } });
        const wrapperConsumer = join(fixture.workspace, 'wrapper-consumer');
        mkdirSync(wrapperConsumer);
        writeFileSync(join(wrapperConsumer, 'package.json'), authoredPackage);
        writeFileSync(join(wrapperConsumer, 'settings.toml'), 'a    =    1\n');
        writeFileSync(join(wrapperConsumer, 'notes.json'), '"text"   ');
        const wrapperOptions = { ...setupOptions, cwd: wrapperConsumer };
        const wrapperInit = await run(
            [
                ...command,
                'init',
                '--yes',
                '--configurations',
                'configs',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
                '--json',
            ],
            wrapperOptions,
        );
        expect(wrapperInit.code, wrapperInit.stdout + wrapperInit.stderr).toBe(0);
        const wrapperLevel = await run([...command, 'set', 'level', 'all', '--json'], wrapperOptions);
        expect(wrapperLevel.code, wrapperLevel.stdout + wrapperLevel.stderr).toBe(0);
        const wrapperInstall = await run([...command, 'install', '--json'], wrapperOptions);
        expect(wrapperInstall.code, wrapperInstall.stdout + wrapperInstall.stderr).toBe(0);
        const tomlFormat = [
            ...command,
            'check',
            'settings.toml',
            '--only',
            'configs/toml-format',
            '--no-cache',
            '--json',
        ];
        const unformattedToml = await run(tomlFormat, wrapperOptions);
        expect(unformattedToml.code, unformattedToml.stdout + unformattedToml.stderr).toBe(1);
        const tomlReport = reportSchema.parse(JSON.parse(unformattedToml.stdout));
        expect(tomlReport.skips).toStrictEqual([]);
        expect(tomlReport.checks).toHaveLength(1);
        expect(tomlReport.checks[0]).toMatchObject({
            check: 'configs/toml-format',
            status: 'fail',
            files: 1,
        });
        expect(
            tomlReport.checks[0]!.findings.map(({ check, file, message, fixable }) => ({
                check,
                file,
                message,
                fixable,
            })),
        ).toStrictEqual([
            {
                check: 'configs/toml-format',
                file: 'settings.toml',
                message: 'The file is not formatted with the configured TOML settings.',
                fixable: true,
            },
        ]);
        expect(
            relative(realpathSync(wrapperConsumer), tomlReport.checks[0]!.command![0]!).replaceAll('\\', '/'),
        ).toStartWith('.gspot/node_modules/');
        const fixedToml = await run([...tomlFormat, '--fix'], wrapperOptions);
        expect(fixedToml.code, fixedToml.stdout + fixedToml.stderr).toBe(0);
        expect(readFileSync(join(wrapperConsumer, 'settings.toml'), 'utf8')).toBe('a = 1\n');
        const formattedToml = await run(tomlFormat, wrapperOptions);
        expect(formattedToml.code, formattedToml.stdout + formattedToml.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(formattedToml.stdout)).checks).toMatchObject([
            { check: 'configs/toml-format', status: 'ok', files: 1, findings: [] },
        ]);
        writeFileSync(join(wrapperConsumer, 'settings.toml'), 'a = [\n');
        const tomlSyntax = [...command, 'check', 'settings.toml', '--only', 'configs/toml', '--no-cache', '--json'];
        const invalidToml = await run(tomlSyntax, wrapperOptions);
        expect(invalidToml.code, invalidToml.stdout + invalidToml.stderr).toBe(1);
        const syntaxReport = reportSchema.parse(JSON.parse(invalidToml.stdout));
        expect(syntaxReport.skips).toStrictEqual([]);
        expect(syntaxReport.checks).toHaveLength(1);
        expect(syntaxReport.checks[0]).toMatchObject({ check: 'configs/toml', status: 'fail', files: 1 });
        expect(
            syntaxReport.checks[0]!.findings.map(({ check, file, line, column, message, fixable }) => ({
                check,
                file,
                line,
                column,
                message,
                fixable,
            })),
        ).toStrictEqual([
            {
                check: 'configs/toml',
                file: 'settings.toml',
                line: 2,
                column: 1,
                message: 'The file does not parse as TOML.',
                fixable: false,
            },
        ]);
        writeFileSync(join(wrapperConsumer, 'settings.toml'), 'a = 1\n');
        const validToml = await run(tomlSyntax, wrapperOptions);
        expect(validToml.code, validToml.stdout + validToml.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(validToml.stdout)).checks).toMatchObject([
            { check: 'configs/toml', status: 'ok', files: 1, findings: [] },
        ]);
        const whitespaceCommand = [
            ...command,
            'check',
            'notes.json',
            '--only',
            'formatting/editorconfig-checker',
            '--no-cache',
            '--json',
        ];
        const trailingWhitespace = await run(whitespaceCommand, wrapperOptions);
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
            whitespaceReport.checks[0]!.findings.map(({ check, file, line, message, fixable }) => ({
                check,
                file,
                line,
                message,
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
            relative(realpathSync(wrapperConsumer), whitespaceReport.checks[0]!.command![0]!).replaceAll('\\', '/'),
        ).toStartWith('.gspot/node_modules/');
        writeFileSync(join(wrapperConsumer, 'notes.json'), '"text"\n');
        const cleanWhitespace = await run(whitespaceCommand, wrapperOptions);
        expect(cleanWhitespace.code, cleanWhitespace.stdout + cleanWhitespace.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(cleanWhitespace.stdout)).checks).toMatchObject([
            { check: 'formatting/editorconfig-checker', status: 'ok', files: 1, findings: [] },
        ]);
        expect(readFileSync(join(wrapperConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
    },
    RELEASE_TIMEOUT_MS,
);
