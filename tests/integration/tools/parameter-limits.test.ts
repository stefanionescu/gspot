import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { LINT_TIMEOUT_MS } from '#tests/config/integration/tools/tools.ts';

const cases = [
    {
        language: 'python',
        file: 'example.py',
        configName: '.gspot/config/ruff.toml',
        command: ['ruff', 'check', '--config', '.gspot/config/ruff.toml', '--output-format', 'json', 'example.py'],
        source: [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                const name = count === 7 ? 'seven' : 'eight';
                return `def ${name}(${names.join(', ')}):\n    return ${names.join(' + ')}\n`;
            })
            .join('\n'),
        finding: { code: 'PLR0913', location: { row: 4 } },
        failureStatus: 1,
    },
    {
        language: 'swift',
        file: 'example.swift',
        configName: '.gspot/config/swiftlint.yml',
        command: [
            'swiftlint',
            'lint',
            '--config',
            '.gspot/config/swiftlint.yml',
            '--reporter',
            'json',
            '--quiet',
            '--no-cache',
            'example.swift',
        ],
        source: [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                const name = count === 7 ? 'seven' : 'eight';
                const parameters = names.map((parameter) => `${parameter}: Int = 0`).join(', ');
                return `func ${name}(${parameters}) -> Int { return ${names.join(' + ')} }`;
            })
            .join('\n'),
        finding: { rule_id: 'function_parameter_count', line: 2 },
        failureStatus: 2,
    },
];

// SwiftLint ships no Windows build, which its tool pin records.
for (const scenario of cases.filter((entry) => entry.language !== 'swift' || process.platform !== 'win32')) {
    test.each([7, 8])(`${scenario.language} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const { language, configName } = scenario;
        const limits = maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${String(maximum)}\n`;
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nlevel = "all"\nkits = ["${language}"]\n${limits}`,
            [scenario.file]: scenario.source,
        });
        const session = await openSession(directory.path);
        const files = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        }).files;
        const config = files.find(({ path }) => path === configName)!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(directory.path, configName), config.content);
        const result = Bun.spawnSync(scenario.command, {
            cwd: directory.path,
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: LINT_TIMEOUT_MS,
        });
        const findings = JSON.parse(result.stdout.toString()) as {
            code?: string;
            rule_id?: string;
            severity?: string;
            line?: number;
            location?: { row: number };
        }[];
        const failed =
            language === 'python' ? findings.length > 0 : findings.some((finding) => finding.severity === 'Error');
        expect(result.exitCode, result.stderr.toString()).toBe(failed ? scenario.failureStatus : 0);
        expect(
            findings.filter((finding) => finding.code === 'PLR0913' || finding.rule_id === 'function_parameter_count'),
        ).toMatchObject(maximum === 7 ? [scenario.finding] : []);
    });
}
