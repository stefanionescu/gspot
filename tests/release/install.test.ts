// Installs built packages from an isolated registry and checks a fresh consumer.
import { createRequire } from 'node:module';
import { releaseTargets } from '../../packages/cli/config/targets.ts';
import { join, dirname, delimiter, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import prettier from 'prettier';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { reportSchema } from '#cli/run/report-schema.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { publishTo, startRegistry } from '#tests/harness/registry/lifecycle.ts';
import { environmentVariables, isReleaseTestWanted } from '#cli/platform/environment.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const requireCli = createRequire(join(root, 'packages/cli/package.json'));
const { familySync } = requireCli('detect-libc') as { familySync: () => string | null };
const libc = process.platform === 'linux' ? familySync() : null;
const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
)!;
const BINARY = host.binary;
const RELEASE_TIMEOUT_MS = 180_000;

// Consumer processes cannot discover executables from the source checkout.
const environment: Record<string, string | undefined> = {
    ...environmentVariables(),
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
};
environment['PATH'] = (environment['PATH'] ?? '')
    .split(delimiter)
    .filter((entry) => {
        const path = relative(root, resolve(entry));
        return path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || path === '..' || isAbsolute(path);
    })
    .join(delimiter);

describe.skipIf(!isReleaseTestWanted())('the installed consumer', () => {
    test(
        'installs matching packages, initializes, rejects a defect, and accepts its correction',
        async () => {
            const registry = await startRegistry();
            try {
                const built = await run([join(root, 'dist', BINARY), '--version'], {
                    cwd: registry.work,
                    env: environment,
                    timeoutMs: RELEASE_TIMEOUT_MS,
                });
                expect(built.code, built.stdout + built.stderr).toBe(0);
                const version = built.stdout.trim();
                expect(version).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u);
                const missing = join(root, 'dist', 'gspot-linux-arm64-musl');
                const retained = join(registry.work, 'retained-binary');
                renameSync(missing, retained);
                try {
                    const refused = publishTo(registry, version);
                    expect(refused.code).not.toBe(0);
                    const absent = await fetch(`${registry.url}/gspot`);
                    expect(absent.status).toBe(404);
                    await absent.arrayBuffer();
                } finally {
                    renameSync(retained, missing);
                }
                const dependency = await run(
                    [
                        'npm',
                        'publish',
                        dirname(requireCli.resolve('detect-libc/package.json')),
                        '--registry',
                        registry.url,
                        '--userconfig',
                        registry.npmrc,
                        '--ignore-scripts',
                    ],
                    { cwd: registry.work, env: environment, timeoutMs: RELEASE_TIMEOUT_MS },
                );
                expect(dependency.code, dependency.stdout + dependency.stderr).toBe(0);
                const published = publishTo(registry, version);
                expect(published.code, published.stdout + published.stderr).toBe(0);
                const consumer = join(registry.work, 'consumer');
                mkdirSync(consumer);
                writeFileSync(join(consumer, 'package.json'), '{"name":"consumer","private":true}\n');
                const editorconfig = 'root = true\n[*]\nindent_size = 2\n[*.json]\nindent_size = 4\n';
                writeFileSync(join(consumer, '.editorconfig'), editorconfig, { mode: 0o640 });
                const formatter =
                    'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n';
                writeFileSync(join(consumer, 'prettier.config.mjs'), formatter);
                writeFileSync(join(consumer, 'source.js'), 'const greeting="hello";');
                writeFileSync(join(consumer, 'broken.sh'), 'if then\n');
                writeFileSync(join(consumer, 'authored.txt'), 'Preserve this authored file.\n');
                const installed = await run(
                    [
                        'npm',
                        'install',
                        `gspot@${version}`,
                        '--ignore-scripts',
                        '--registry',
                        registry.url,
                        '--no-audit',
                        '--no-fund',
                    ],
                    {
                        cwd: consumer,
                        env: { ...environment, NPM_CONFIG_USERCONFIG: registry.npmrc },
                        timeoutMs: RELEASE_TIMEOUT_MS,
                    },
                );
                expect(installed.code, installed.stdout + installed.stderr).toBe(0);
                const launcherDirectory = join(consumer, 'node_modules', 'gspot');
                const platformName = host.package;
                const platformDirectory = join(consumer, 'node_modules', platformName);
                expect(lstatSync(launcherDirectory).isSymbolicLink()).toBe(false);
                expect(lstatSync(platformDirectory).isSymbolicLink()).toBe(false);
                const launcher = await Bun.file(join(launcherDirectory, 'package.json')).json();
                const platform = await Bun.file(join(platformDirectory, 'package.json')).json();
                expect(launcher.version).toBe(version);
                expect(launcher.optionalDependencies[platformName]).toBe(version);
                expect(platform.version).toBe(version);
                for (const directory of [launcherDirectory, platformDirectory]) {
                    expect(readFileSync(join(directory, 'LICENSE.md'), 'utf8')).toBe(
                        readFileSync(join(root, 'LICENSE.md'), 'utf8'),
                    );
                }
                expect(readFileSync(join(platformDirectory, 'NOTICE.md'), 'utf8')).toBe(
                    readFileSync(join(root, 'dist/NOTICE.md'), 'utf8'),
                );
                const command = ['node', join(launcherDirectory, 'gspot.js')];
                const options = {
                    cwd: consumer,
                    env: {
                        ...environment,
                        NO_COLOR: '1',
                        CI: '1',
                        HTTP_PROXY: 'http://127.0.0.1:1',
                        HTTPS_PROXY: 'http://127.0.0.1:1',
                        ALL_PROXY: 'http://127.0.0.1:1',
                        NO_PROXY: '',
                        http_proxy: undefined,
                        https_proxy: undefined,
                        all_proxy: undefined,
                        no_proxy: undefined,
                    },
                    timeoutMs: RELEASE_TIMEOUT_MS,
                };
                const cancellation = join(registry.work, 'cancellation');
                mkdirSync(cancellation);
                writeFileSync(join(cancellation, 'source.txt'), 'input\n');
                for (const signal of ['SIGINT', 'SIGTERM'] as const) {
                    const marker = `${signal}.pid`;
                    const tool = [
                        'node',
                        '-e',
                        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setTimeout(() => {}, 60000);`,
                    ];
                    writeFileSync(
                        join(cancellation, 'gspot.toml'),
                        `version = 1\npresets = []\n[[check]]\nname = "project/slow"\nstage = "commit"\npaths = ["source.txt"]\ncommand = ${JSON.stringify(tool)}\n`,
                    );
                    const child = Bun.spawn([...command, 'check', '--json', '--no-cache'], {
                        cwd: cancellation,
                        env: options.env,
                        stdout: 'pipe',
                        stderr: 'pipe',
                    });
                    const output = new Response(child.stdout).text();
                    const errors = new Response(child.stderr).text();
                    let toolPid: number | undefined;
                    try {
                        const deadline = performance.now() + 10000;
                        while (!existsSync(join(cancellation, marker)) && performance.now() < deadline)
                            await Bun.sleep(20);
                        expect(existsSync(join(cancellation, marker))).toBe(true);
                        toolPid = Number(readFileSync(join(cancellation, marker), 'utf8'));
                        child.kill(signal);
                        expect(await child.exited, await errors).toBe(1);
                        const canceled = reportSchema.parse(JSON.parse(await output));
                        expect(canceled.checks[0]?.status).toBe('error');
                        expect(canceled.checks[0]?.note).toContain('canceled');
                        expect(() => process.kill(toolPid!, 0)).toThrow();
                    } finally {
                        if (child.exitCode === null) child.kill('SIGKILL');
                        if (toolPid !== undefined) {
                            try {
                                process.kill(toolPid, 'SIGKILL');
                            } catch (error) {
                                if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH')
                                    throw error;
                            }
                        }
                        await child.exited;
                        await output;
                        await errors;
                    }
                }
                const setupOptions = { ...options, env: { ...environment, NO_COLOR: '1', CI: '1' } };
                const initialized = await run(
                    [
                        ...command,
                        'init',
                        '--json',
                        '--yes',
                        '--presets',
                        'bash',
                        'naming',
                        'prose',
                        'python',
                        'swift',
                        'formatting',
                        '--no-runner',
                        '--no-ci',
                        '--no-hooks',
                        '--no-install',
                    ],
                    setupOptions,
                );
                expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
                expect(existsSync(join(consumer, 'gspot.toml'))).toBe(true);
                expect(readFileSync(join(consumer, '.editorconfig'), 'utf8')).toBe(editorconfig);
                expect(lstatSync(join(consumer, '.editorconfig')).mode & 0o777).toBe(0o640);
                expect(readFileSync(join(consumer, 'prettier.config.mjs'), 'utf8')).toBe(formatter);
                expect(() => JSON.parse(initialized.stdout)).not.toThrow();
                expect(initialized.stdout).not.toContain('formatter stdout');
                const filepath = join(consumer, 'source.js');
                const carried = await prettier.resolveConfig(filepath, {
                    config: join(consumer, '.gspot/prettier.json'),
                    editorconfig: false,
                    useCache: false,
                });
                expect(await prettier.format(readFileSync(filepath, 'utf8'), { ...carried, filepath })).toBe(
                    'const greeting = "hello"\n',
                );
                expect(existsSync(join(consumer, '.gspot', 'report.json'))).toBe(false);
                const checked = await run(
                    [...command, 'check', '--only', 'bash/syntax', '--no-cache', '--json'],
                    options,
                );
                expect(checked.code, checked.stdout + checked.stderr).toBe(1);
                const report = reportSchema.parse(JSON.parse(checked.stdout));
                expect(report.exitCode).toBe(1);
                expect(JSON.parse(readFileSync(join(consumer, '.gspot/report.json'), 'utf8'))).toEqual(report);
                const sarif = JSON.parse(readFileSync(join(consumer, '.gspot/report.sarif'), 'utf8'));
                expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(true);
                const quality = JSON.parse(readFileSync(join(consumer, '.gspot/report.codequality.json'), 'utf8'));
                expect(quality).toHaveLength(report.checks[0]?.findings.length ?? 0);
                expect(quality[0]).toMatchObject({
                    check_name: 'bash/syntax',
                    severity: 'major',
                    location: { path: 'broken.sh', lines: { begin: 1 } },
                });
                expect(report.skips).toEqual([]);
                expect(report.checks).toHaveLength(1);
                expect(report.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'fail', files: 1 });
                expect(
                    report.checks[0]!.findings.map(({ check, file, line, message }) => ({
                        check,
                        file,
                        line,
                        message,
                    })),
                ).toEqual([
                    {
                        check: 'bash/syntax',
                        file: 'broken.sh',
                        line: 1,
                        message: "syntax error near unexpected token `then'",
                    },
                    { check: 'bash/syntax', file: 'broken.sh', line: 1, message: "`if then'" },
                ]);
                writeFileSync(join(consumer, 'broken.sh'), 'echo example\n');
                const corrected = await run(
                    [...command, 'check', '--only', 'bash/syntax', '--no-cache', '--json'],
                    options,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                const clean = reportSchema.parse(JSON.parse(corrected.stdout));
                expect(clean.exitCode).toBe(0);
                expect(JSON.parse(readFileSync(join(consumer, '.gspot/report.codequality.json'), 'utf8'))).toEqual([]);
                expect(clean.skips).toEqual([]);
                expect(clean.checks).toHaveLength(1);
                expect(clean.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'ok', files: 1, findings: [] });
                const optIn = await run([...command, 'set', 'extra_checks', 'naming/identifiers'], options);
                expect(optIn.code, optIn.stdout + optIn.stderr).toBe(0);
                writeFileSync(join(consumer, 'broken.sh'), 'command=example\n');
                const renamed = await run(
                    [...command, 'check', 'broken.sh', '--only', 'naming/identifiers', '--no-cache', '--json'],
                    options,
                );
                expect(renamed.code, renamed.stdout + renamed.stderr).toBe(0);
                const acceptedName = reportSchema.parse(JSON.parse(renamed.stdout));
                expect(acceptedName.skips).toEqual([]);
                expect(acceptedName.checks).toHaveLength(1);
                expect(acceptedName.checks[0]).toMatchObject({
                    check: 'naming/identifiers',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                expect(readFileSync(join(consumer, 'authored.txt'), 'utf8')).toBe('Preserve this authored file.\n');
                const vocabulary = await run(
                    [...command, 'set', 'prose.vocabulary', 'NebulaKit', '--reason', 'NebulaKit is the project name.'],
                    options,
                );
                expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
                const valePin = presetManifests()
                    .get('prose')!
                    .tools.find((tool) => tool.name === 'vale')!;
                const valeVersion = await run(['vale', '--version'], options);
                expect(valeVersion.code, valeVersion.stdout + valeVersion.stderr).toBe(0);
                expect(valeVersion.stdout).toContain(valePin.version!);
                writeFileSync(
                    join(consumer, 'guide.md'),
                    '# Schedule\n\nNebulaKit uses TypeScript. Release on 03/04/2026.\n',
                );
                const proseCommand = [...command, 'check', 'guide.md', '--only', 'prose/vale', '--no-cache', '--json'];
                const ambiguous = await run(proseCommand, options);
                expect(ambiguous.code, ambiguous.stdout + ambiguous.stderr).toBe(1);
                const proseReport = reportSchema.parse(JSON.parse(ambiguous.stdout));
                expect(proseReport.skips).toEqual([]);
                expect(proseReport.checks).toHaveLength(1);
                expect(proseReport.checks[0]).toMatchObject({
                    check: 'prose/vale',
                    status: 'fail',
                    files: 1,
                    findings: [
                        {
                            check: 'prose/vale',
                            file: 'guide.md',
                            line: 3,
                            rule: 'gspot.dates',
                            message: "Ambiguous date '03/04/2026'. Write ISO dates (2026-09-17) or the month name.",
                        },
                    ],
                });
                writeFileSync(
                    join(consumer, 'guide.md'),
                    '# Schedule\n\nNebulaKit uses TypeScript. Release on March 4, 2026.\n',
                );
                const clearDate = await run(proseCommand, options);
                expect(clearDate.code, clearDate.stdout + clearDate.stderr).toBe(0);
                const clearReport = reportSchema.parse(JSON.parse(clearDate.stdout));
                expect(clearReport.skips).toEqual([]);
                expect(clearReport.checks).toHaveLength(1);
                expect(clearReport.checks[0]).toMatchObject({
                    check: 'prose/vale',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                writeFileSync(
                    join(consumer, 'vocabulary.ini'),
                    'StylesPath = .gspot/vale/styles\nVocab = gspot\nMinAlertLevel = suggestion\n\n[*]\nBasedOnStyles = Vale\nVale.Spelling = NO\nVale.Terms = YES\n',
                );
                writeFileSync(join(consumer, 'vocabulary.md'), 'typescript supports nebulakit.\n');
                const termsCommand = [
                    'vale',
                    '--config',
                    'vocabulary.ini',
                    '--output',
                    'JSON',
                    '--no-exit',
                    'vocabulary.md',
                ];
                const terms = await run(termsCommand, options);
                expect(terms.code, terms.stdout + terms.stderr).toBe(0);
                const alerts = JSON.parse(terms.stdout) as Record<
                    string,
                    { Check: string; Line: number; Message: string }[]
                >;
                expect(alerts['vocabulary.md']?.map(({ Check, Line, Message }) => ({ Check, Line, Message }))).toEqual([
                    { Check: 'Vale.Terms', Line: 1, Message: "Use 'TypeScript' instead of 'typescript'." },
                    { Check: 'Vale.Terms', Line: 1, Message: "Use 'NebulaKit' instead of 'nebulakit'." },
                ]);
                writeFileSync(join(consumer, 'vocabulary.md'), 'TypeScript supports NebulaKit.\n');
                const correctedTerms = await run(termsCommand, options);
                expect(correctedTerms.code, correctedTerms.stdout + correctedTerms.stderr).toBe(0);
                expect(JSON.parse(correctedTerms.stdout)).toEqual({});
                const ruffPin = presetManifests()
                    .get('python')!
                    .tools.find((tool) => tool.name === 'ruff')!;
                const ruffVersion = await run(['ruff', '--version'], options);
                expect(ruffVersion.code, ruffVersion.stdout + ruffVersion.stderr).toBe(0);
                expect(ruffVersion.stdout).toContain(ruffPin.version!);
                writeFileSync(join(consumer, 'entry.py'), 'print(missing_name)\n');
                const pythonCommand = [
                    ...command,
                    'check',
                    'entry.py',
                    '--only',
                    'python/ruff',
                    '--no-cache',
                    '--json',
                ];
                const undefinedName = await run(pythonCommand, options);
                expect(undefinedName.code, undefinedName.stdout + undefinedName.stderr).toBe(1);
                const pythonReport = reportSchema.parse(JSON.parse(undefinedName.stdout));
                expect(pythonReport.skips).toEqual([]);
                expect(pythonReport.checks).toHaveLength(1);
                expect(pythonReport.checks[0]).toMatchObject({
                    check: 'python/ruff',
                    status: 'fail',
                    files: 1,
                    findings: [
                        {
                            check: 'python/ruff',
                            file: 'entry.py',
                            line: 1,
                            column: 7,
                            rule: 'F821',
                            message: 'Undefined name `missing_name`',
                        },
                    ],
                });
                writeFileSync(join(consumer, 'entry.py'), 'print("example")\n');
                const definedName = await run(pythonCommand, options);
                expect(definedName.code, definedName.stdout + definedName.stderr).toBe(0);
                const definedReport = reportSchema.parse(JSON.parse(definedName.stdout));
                expect(definedReport.skips).toEqual([]);
                expect(definedReport.checks).toHaveLength(1);
                expect(definedReport.checks[0]).toMatchObject({
                    check: 'python/ruff',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                const shellcheck = presetManifests()
                    .get('bash')!
                    .tools.find((tool) => tool.name === 'shellcheck')!;
                const toolVersion = await run(['shellcheck', '--version'], options);
                expect(toolVersion.code, toolVersion.stdout + toolVersion.stderr).toBe(0);
                expect(toolVersion.stdout).toContain(`version: ${shellcheck.version}\n`);
                writeFileSync(join(consumer, 'broken.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" $1\n');
                const unquoted = await run(
                    [...command, 'check', '--only', 'bash/shellcheck', '--no-cache', '--json'],
                    options,
                );
                expect(unquoted.code, unquoted.stdout + unquoted.stderr).toBe(1);
                const quoting = reportSchema.parse(JSON.parse(unquoted.stdout));
                expect(quoting.skips).toEqual([]);
                expect(quoting.checks).toHaveLength(1);
                expect(quoting.checks[0]).toMatchObject({
                    check: 'bash/shellcheck',
                    status: 'fail',
                    files: 1,
                    findings: [
                        {
                            check: 'bash/shellcheck',
                            file: 'broken.sh',
                            line: 2,
                            column: 15,
                            rule: 'SC2086',
                            message: 'Double quote to prevent globbing and word splitting.',
                        },
                    ],
                });
                writeFileSync(join(consumer, 'broken.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n');
                const quoted = await run(
                    [...command, 'check', '--only', 'bash/shellcheck', '--no-cache', '--json'],
                    options,
                );
                expect(quoted.code, quoted.stdout + quoted.stderr).toBe(0);
                const acceptedQuoting = reportSchema.parse(JSON.parse(quoted.stdout));
                expect(acceptedQuoting.skips).toEqual([]);
                expect(acceptedQuoting.checks).toHaveLength(1);
                expect(acceptedQuoting.checks[0]).toMatchObject({
                    check: 'bash/shellcheck',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                const swiftLevel = await run([...command, 'set', 'level', 'all'], options);
                expect(swiftLevel.code, swiftLevel.stdout + swiftLevel.stderr).toBe(0);
                writeFileSync(join(consumer, 'Account.swift'), 'let utils = 1\n');
                const swiftCommand = [
                    ...command,
                    'check',
                    'Account.swift',
                    '--only',
                    'naming/identifiers',
                    '--no-cache',
                    '--json',
                ];
                const invalidSwift = await run(swiftCommand, options);
                expect(invalidSwift.code, invalidSwift.stdout + invalidSwift.stderr).toBe(1);
                const swiftReport = reportSchema.parse(JSON.parse(invalidSwift.stdout));
                expect(swiftReport.skips).toEqual([]);
                expect(swiftReport.checks).toHaveLength(1);
                expect(swiftReport.checks[0]).toMatchObject({ check: 'naming/identifiers', status: 'fail', files: 1 });
                expect(
                    swiftReport.checks[0]!.findings.map(({ rule, file, line, column, message }) => ({
                        rule,
                        file,
                        line,
                        column,
                        message,
                    })),
                ).toEqual([
                    {
                        rule: 'banned-term',
                        file: 'Account.swift',
                        line: 1,
                        column: 5,
                        message: 'swift constant "utils": "utils" is banned (roles group).',
                    },
                ]);
                writeFileSync(join(consumer, 'Account.swift'), 'let account = 1\n');
                const correctedSwift = await run(swiftCommand, options);
                expect(correctedSwift.code, correctedSwift.stdout + correctedSwift.stderr).toBe(0);
                const acceptedSwift = reportSchema.parse(JSON.parse(correctedSwift.stdout));
                expect(acceptedSwift.skips).toEqual([]);
                expect(acceptedSwift.checks).toHaveLength(1);
                expect(acceptedSwift.checks[0]).toMatchObject({
                    check: 'naming/identifiers',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                writeFileSync(join(consumer, 'query.sql'), 'SELECT 1;\n');
                const detected = await run([...command, 'list', '--json'], options);
                expect(detected.code, detected.stdout + detected.stderr).toBe(0);
                const available = JSON.parse(detected.stdout) as { detected: { name: string; command: string }[] };
                expect(available.detected.find((preset) => preset.name === 'sql')?.command).toBe('gspot add sql');
                const added = await run([...command, 'add', 'sql'], setupOptions);
                expect(added.code, added.stdout + added.stderr).toBe(0);
                const sql = await run(
                    [...command, 'check', 'query.sql', '--only', 'sql/syntax', '--no-cache', '--json'],
                    options,
                );
                expect(sql.code, sql.stdout + sql.stderr).toBe(0);
                const sqlReport = reportSchema.parse(JSON.parse(sql.stdout));
                expect(sqlReport.skips).toEqual([]);
                expect(sqlReport.checks).toHaveLength(1);
                expect(sqlReport.checks[0]).toMatchObject({
                    check: 'sql/syntax',
                    status: 'ok',
                    files: 1,
                    findings: [],
                });
                const formatterPackage = dirname(fileURLToPath(import.meta.resolve('prettier/package.json')));
                const publishedFormatter = await run(
                    ['npm', 'publish', formatterPackage, '--registry', registry.url, '--ignore-scripts'],
                    {
                        cwd: registry.work,
                        env: { ...environment, NPM_CONFIG_USERCONFIG: registry.npmrc },
                        timeoutMs: RELEASE_TIMEOUT_MS,
                    },
                );
                expect(publishedFormatter.code, publishedFormatter.stdout + publishedFormatter.stderr).toBe(0);
                const toolConsumer = join(registry.work, 'tool-consumer');
                const hostTools = join(registry.work, 'host-tools');
                mkdirSync(toolConsumer);
                mkdirSync(hostTools);
                writeFileSync(join(hostTools, 'mise'), '#!/bin/sh\nprintf "2026.5.15\\n"\n', { mode: 0o755 });
                const bun = await run(['bun', '--version'], { cwd: toolConsumer, env: environment });
                expect(bun.code, bun.stdout + bun.stderr).toBe(0);
                const authoredPackage = JSON.stringify({
                    private: true,
                    packageManager: `bun@${bun.stdout.trim()}`,
                    scripts: { test: 'authored-command' },
                });
                writeFileSync(join(toolConsumer, 'package.json'), authoredPackage);
                writeFileSync(join(toolConsumer, '.npmrc'), `registry=${registry.url}\n`);
                writeFileSync(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
                const toolOptions = {
                    cwd: toolConsumer,
                    timeoutMs: RELEASE_TIMEOUT_MS,
                    env: {
                        ...environment,
                        CI: '1',
                        NO_COLOR: '1',
                        PATH: `${hostTools}${delimiter}${environment['PATH'] ?? ''}`,
                        NPM_CONFIG_USERCONFIG: registry.npmrc,
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
                        '--presets',
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
                expect(existsSync(join(toolConsumer, '.gspot/report.json'))).toBe(false);
                const selectedFormatter = await run(
                    [...command, 'set', 'extra_checks', 'formatting/prettier'],
                    toolOptions,
                );
                expect(selectedFormatter.code, selectedFormatter.stdout + selectedFormatter.stderr).toBe(0);
                const toolManifest = readFileSync(join(toolConsumer, '.gspot/package.json'));
                const toolLock = readFileSync(join(toolConsumer, '.gspot/bun.lock'));
                expect(toolLock.toString('utf8')).not.toContain(registry.url);
                expect(toolLock.toString('utf8')).not.toContain(registry.work);
                const previewInstall = await run([...command, 'install', '--dry-run', '--json'], toolOptions);
                expect(previewInstall.code, previewInstall.stdout + previewInstall.stderr).toBe(0);
                expect(JSON.parse(previewInstall.stdout).isDryRun).toBe(true);
                const toolInstall = await run([...command, 'install', '--json'], toolOptions);
                expect(toolInstall.code, toolInstall.stdout + toolInstall.stderr).toBe(1);
                expect(JSON.parse(toolInstall.stdout).error).toContain('Install mise 2026.8.8 or newer');
                expect(JSON.parse(toolInstall.stdout).error).toContain('installed locked npm tools');
                expect(readFileSync(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
                expect(readFileSync(join(toolConsumer, '.gspot/package.json'))).toEqual(toolManifest);
                expect(readFileSync(join(toolConsumer, '.gspot/bun.lock'))).toEqual(toolLock);
                const formatterArgs = ['check', 'source.js', '--only', 'formatting/prettier', '--no-cache', '--json'];
                const invalidFormat = await run([...command, ...formatterArgs], toolOptions);
                expect(invalidFormat.code, invalidFormat.stdout + invalidFormat.stderr).toBe(1);
                const formatReport = reportSchema.parse(JSON.parse(invalidFormat.stdout));
                expect(formatReport.skips).toEqual([]);
                expect(formatReport.checks).toHaveLength(1);
                expect(formatReport.checks[0]).toMatchObject({
                    check: 'formatting/prettier',
                    status: 'fail',
                    files: 1,
                });
                expect(
                    formatReport.checks[0]!.findings.map(({ check, file, message }) => ({ check, file, message })),
                ).toEqual([
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
                const wrapperConsumer = join(registry.work, 'wrapper-consumer');
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
                        '--presets',
                        'config-files',
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
                    'config-files/toml-format',
                    '--no-cache',
                    '--json',
                ];
                const unformattedToml = await run(tomlFormat, wrapperOptions);
                expect(unformattedToml.code, unformattedToml.stdout + unformattedToml.stderr).toBe(1);
                const tomlReport = reportSchema.parse(JSON.parse(unformattedToml.stdout));
                expect(tomlReport.skips).toEqual([]);
                expect(tomlReport.checks).toHaveLength(1);
                expect(tomlReport.checks[0]).toMatchObject({
                    check: 'config-files/toml-format',
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
                ).toEqual([
                    {
                        check: 'config-files/toml-format',
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
                    { check: 'config-files/toml-format', status: 'ok', files: 1, findings: [] },
                ]);
                writeFileSync(join(wrapperConsumer, 'settings.toml'), 'a = [\n');
                const tomlSyntax = [
                    ...command,
                    'check',
                    'settings.toml',
                    '--only',
                    'config-files/toml',
                    '--no-cache',
                    '--json',
                ];
                const invalidToml = await run(tomlSyntax, wrapperOptions);
                expect(invalidToml.code, invalidToml.stdout + invalidToml.stderr).toBe(1);
                const syntaxReport = reportSchema.parse(JSON.parse(invalidToml.stdout));
                expect(syntaxReport.skips).toEqual([]);
                expect(syntaxReport.checks).toHaveLength(1);
                expect(syntaxReport.checks[0]).toMatchObject({ check: 'config-files/toml', status: 'fail', files: 1 });
                expect(
                    syntaxReport.checks[0]!.findings.map(({ check, file, line, column, message, fixable }) => ({
                        check,
                        file,
                        line,
                        column,
                        message,
                        fixable,
                    })),
                ).toEqual([
                    {
                        check: 'config-files/toml',
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
                    { check: 'config-files/toml', status: 'ok', files: 1, findings: [] },
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
                expect(whitespaceReport.skips).toEqual([]);
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
                ).toEqual([
                    {
                        check: 'formatting/editorconfig-checker',
                        file: 'notes.json',
                        line: 1,
                        message: 'Trailing whitespace',
                        fixable: false,
                    },
                ]);
                expect(
                    relative(realpathSync(wrapperConsumer), whitespaceReport.checks[0]!.command![0]!).replaceAll(
                        '\\',
                        '/',
                    ),
                ).toStartWith('.gspot/node_modules/');
                writeFileSync(join(wrapperConsumer, 'notes.json'), '"text"\n');
                const cleanWhitespace = await run(whitespaceCommand, wrapperOptions);
                expect(cleanWhitespace.code, cleanWhitespace.stdout + cleanWhitespace.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(cleanWhitespace.stdout)).checks).toMatchObject([
                    { check: 'formatting/editorconfig-checker', status: 'ok', files: 1, findings: [] },
                ]);
                expect(readFileSync(join(wrapperConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
            } finally {
                await registry.stop();
            }
        },
        RELEASE_TIMEOUT_MS,
    );
});
