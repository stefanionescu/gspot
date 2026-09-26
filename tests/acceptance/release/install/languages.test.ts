// Installs built packages from an isolated registry: the pinned language tools report defects and accept corrections.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import { afterAll, expect, test } from 'bun:test';
import { runProcess as run } from '#tests/support/cli/command.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/support/release/packages.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { installedConsumer, initializeConsumer, publishRelease } from '#tests/support/release/published.ts';

// The release publishes once for this file, and its registry stops when the file's tests end.
const release = await publishRelease();
afterAll(async () => {
    await release.registry.stop();
});

test(
    'installed prose and vocabulary reject defects and accept corrections',
    async () => {
        await using fixture = await installedConsumer(release);
        const { consumer, command, options } = fixture;
        await initializeConsumer(release, fixture);
        const vocabulary = await run(
            [...command, 'set', 'prose.vocabulary', 'NebulaKit', '--reason', 'NebulaKit is the project name.'],
            options,
        );
        expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
        const valePin = configurationManifests()
            .get('prose')!
            .tools.find((tool) => tool.name === 'vale')!;
        const valeVersion = await run(['vale', '--version'], options);
        expect(valeVersion.code, valeVersion.stdout + valeVersion.stderr).toBe(0);
        expect(valeVersion.stdout).toContain(valePin.version!);
        writeFileSync(join(consumer, 'guide.md'), '# Schedule\n\nNebulaKit uses TypeScript. Release on 03/04/2026.\n');
        const proseCommand = [...command, 'check', 'guide.md', '--only', 'prose/vale', '--no-cache', '--json'];
        const ambiguous = await run(proseCommand, options);
        expect(ambiguous.code, ambiguous.stdout + ambiguous.stderr).toBe(1);
        const proseReport = reportSchema.parse(JSON.parse(ambiguous.stdout));
        expect(proseReport.skips).toStrictEqual([]);
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
        expect(clearReport.skips).toStrictEqual([]);
        expect(clearReport.checks).toHaveLength(1);
        expect(clearReport.checks[0]).toMatchObject({
            check: 'prose/vale',
            status: 'ok',
            files: 1,
            findings: [],
        });
        writeFileSync(
            join(consumer, 'vocabulary.ini'),
            'StylesPath = .gspot/config/vale/styles\nVocab = gspot\nMinAlertLevel = suggestion\n\n[*]\nBasedOnStyles = Vale\nVale.Spelling = NO\nVale.Terms = YES\n',
        );
        writeFileSync(join(consumer, 'vocabulary.md'), 'typescript supports nebulakit.\n');
        const termsCommand = ['vale', '--config', 'vocabulary.ini', '--output', 'JSON', '--no-exit', 'vocabulary.md'];
        const terms = await run(termsCommand, options);
        expect(terms.code, terms.stdout + terms.stderr).toBe(0);
        const alerts = JSON.parse(terms.stdout) as Record<string, { Check: string; Line: number; Message: string }[]>;
        expect(alerts['vocabulary.md']?.map(({ Check, Line, Message }) => ({ Check, Line, Message }))).toStrictEqual([
            { Check: 'Vale.Terms', Line: 1, Message: "Use 'TypeScript' instead of 'typescript'." },
            { Check: 'Vale.Terms', Line: 1, Message: "Use 'NebulaKit' instead of 'nebulakit'." },
        ]);
        writeFileSync(join(consumer, 'vocabulary.md'), 'TypeScript supports NebulaKit.\n');
        const correctedTerms = await run(termsCommand, options);
        expect(correctedTerms.code, correctedTerms.stdout + correctedTerms.stderr).toBe(0);
        expect(JSON.parse(correctedTerms.stdout)).toStrictEqual({});
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed Python detects an undefined name and accepts its correction',
    async () => {
        await using fixture = await installedConsumer(release);
        const { consumer, command, options } = fixture;
        await initializeConsumer(release, fixture);
        const ruffPin = configurationManifests()
            .get('python')!
            .tools.find((tool) => tool.name === 'ruff')!;
        const ruffVersion = await run(['ruff', '--version'], options);
        expect(ruffVersion.code, ruffVersion.stdout + ruffVersion.stderr).toBe(0);
        expect(ruffVersion.stdout).toContain(ruffPin.version!);
        writeFileSync(join(consumer, 'entry.py'), 'print(missing_name)\n');
        const pythonCommand = [...command, 'check', 'entry.py', '--only', 'python/ruff', '--no-cache', '--json'];
        const undefinedName = await run(pythonCommand, options);
        expect(undefinedName.code, undefinedName.stdout + undefinedName.stderr).toBe(1);
        const pythonReport = reportSchema.parse(JSON.parse(undefinedName.stdout));
        expect(pythonReport.skips).toStrictEqual([]);
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
        expect(definedReport.skips).toStrictEqual([]);
        expect(definedReport.checks).toHaveLength(1);
        expect(definedReport.checks[0]).toMatchObject({
            check: 'python/ruff',
            status: 'ok',
            files: 1,
            findings: [],
        });
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed ShellCheck reports exact quoting diagnostics and accepts correction',
    async () => {
        await using fixture = await installedConsumer(release);
        const { consumer, command, options } = fixture;
        await initializeConsumer(release, fixture);
        const shellcheck = configurationManifests()
            .get('bash')!
            .tools.find((tool) => tool.name === 'shellcheck')!;
        const toolVersion = await run(['shellcheck', '--version'], options);
        expect(toolVersion.code, toolVersion.stdout + toolVersion.stderr).toBe(0);
        expect(toolVersion.stdout).toContain(`version: ${shellcheck.version}\n`);
        writeFileSync(join(consumer, 'broken.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" $1\n');
        const unquoted = await run([...command, 'check', '--only', 'bash/shellcheck', '--no-cache', '--json'], options);
        expect(unquoted.code, unquoted.stdout + unquoted.stderr).toBe(1);
        const quoting = reportSchema.parse(JSON.parse(unquoted.stdout));
        expect(quoting.skips).toStrictEqual([]);
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
        const quoted = await run([...command, 'check', '--only', 'bash/shellcheck', '--no-cache', '--json'], options);
        expect(quoted.code, quoted.stdout + quoted.stderr).toBe(0);
        const acceptedQuoting = reportSchema.parse(JSON.parse(quoted.stdout));
        expect(acceptedQuoting.skips).toStrictEqual([]);
        expect(acceptedQuoting.checks).toHaveLength(1);
        expect(acceptedQuoting.checks[0]).toMatchObject({
            check: 'bash/shellcheck',
            status: 'ok',
            files: 1,
            findings: [],
        });
    },
    RELEASE_TIMEOUT_MS,
);

test(
    'installed Swift and SQL parsers execute without checkout dependencies',
    async () => {
        await using fixture = await installedConsumer(release);
        const { consumer, command, options, setupOptions } = fixture;
        await initializeConsumer(release, fixture);
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
        expect(swiftReport.skips).toStrictEqual([]);
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
        ).toStrictEqual([
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
        expect(acceptedSwift.skips).toStrictEqual([]);
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
        expect(available.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
        const added = await run([...command, 'add', 'sql'], setupOptions);
        expect(added.code, added.stdout + added.stderr).toBe(0);
        const sql = await run(
            [...command, 'check', 'query.sql', '--only', 'sql/syntax', '--no-cache', '--json'],
            options,
        );
        expect(sql.code, sql.stdout + sql.stderr).toBe(0);
        const sqlReport = reportSchema.parse(JSON.parse(sql.stdout));
        expect(sqlReport.skips).toStrictEqual([]);
        expect(sqlReport.checks).toHaveLength(1);
        expect(sqlReport.checks[0]).toMatchObject({
            check: 'sql/syntax',
            status: 'ok',
            files: 1,
            findings: [],
        });
    },
    RELEASE_TIMEOUT_MS,
);
