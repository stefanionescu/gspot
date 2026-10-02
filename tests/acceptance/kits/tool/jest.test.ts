import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { INSTALLED_BIN_PATH } from '#tests/harness/cli/modules.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

const source =
    'function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }\nfunction triple(value) { return value * 3; }\nmodule.exports = { total, triple };\n';
const planted =
    'const { total, triple } = require("./math.cjs");\nconst { writeFileSync } = require("node:fs");\ntest("adds positive values", () => { writeFileSync("authored.txt", "isolated test output"); expect(total([2, -1, 3])).toBe(5); });\n';
const corrected = `${planted}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

test(
    'native Jest at all applies nested coverage settings without executing sibling tests',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['javascript'],
                '[[scope]]\npath = "app"\nkits = ["jest"]\n[scope.tools.jest]\ncoverage_functions = 100\n',
                'all',
            ),
            'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
            'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
            'app/package.json': '{"name":"jest-nested","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
            'app/math.cjs': source,
            'app/math.test.cjs': planted,
            'app/authored.txt': 'preserved nested source\n',
        });
        const environment = { PATH: `${INSTALLED_BIN_PATH}${delimiter}${toolsPath([])}` };
        const command = ['check', '--stage', 'push', '--only', 'jest/coverage', '--json'];
        const uncovered = await run(sandbox.path, command, environment);
        expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
        const report = JSON.parse(uncovered.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'fail' }]);
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({ rule: 'coverage-functions', message: textContaining('100% floor') }),
        );
        await Bun.write(join(sandbox.path, 'app/math.test.cjs'), corrected);
        const passing = await run(sandbox.path, command, environment);
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
            { check: 'jest/coverage', scope: 'app', status: 'ok', findings: [] },
        ]);
        expect((JSON.parse(passing.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
        expect(readFileSync(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
    },
    PLANTED_TIMEOUT_MS * 2,
);

test(
    'native Jest at all reports uncovered functions and failed tests while preserving working-tree files',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['jest'],
                '[tools.jest]\ncoverage_lines = 80\ncoverage_branches = 80\ncoverage_functions = 80\ncoverage_statements = 80\n',
                'all',
            ),
            'package.json': '{"name":"jest-acceptance","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
            'math.cjs': source,
            'math.test.cjs': planted,
            'authored.txt': 'preserved source\n',
            'coverage/authored.txt': 'preserved report\n',
        });
        const environment = { PATH: `${INSTALLED_BIN_PATH}${delimiter}${toolsPath([])}` };
        const command = ['check', '--stage', 'push', '--only', 'jest/coverage', '--json'];
        const uncovered = await run(sandbox.path, command, environment);
        expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
        expect((JSON.parse(uncovered.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
            containing({ rule: 'coverage-lines' }),
            containing({
                check: 'jest/coverage',
                rule: 'coverage-functions',
                message: textContaining('50%'),
            }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected);
        const passing = await run(sandbox.path, command, environment);
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
            { check: 'jest/coverage', status: 'ok', findings: [] },
        ]);
        expect((JSON.parse(passing.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected.replace('toBe(6)', 'toBe(7)'));
        const failed = await run(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
            containing({ rule: 'test-failure', file: 'math.test.cjs', line: 4 }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), 'require("./missing-test-dependency.cjs");\n');
        const unavailable = await run(sandbox.path, command, environment);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect((JSON.parse(unavailable.stdout) as RunReport).checks).toStrictEqual([
            containing({ check: 'jest/coverage', status: 'error' }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected);
        const recovered = await run(sandbox.path, command, environment);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect((JSON.parse(recovered.stdout) as RunReport).checks).toMatchObject([
            { check: 'jest/coverage', status: 'ok', findings: [] },
        ]);
        expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
        expect(readFileSync(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
        expect(readFileSync(join(sandbox.path, 'math.cjs'), 'utf8')).toBe(source);
    },
    PLANTED_TIMEOUT_MS * 4,
);
