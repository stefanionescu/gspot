import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

const modules = join(import.meta.dir, '../../../../node_modules');
const source =
    'function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }\nfunction triple(value) { return value * 3; }\nmodule.exports = { total, triple };\n';
const planted =
    'const { total, triple } = require("./math.cjs");\nconst { writeFileSync } = require("node:fs");\ntest("adds positive values", () => { writeFileSync("authored.txt", "isolated test output"); expect(total([2, -1, 3])).toBe(5); });\n';
const corrected = `${planted}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

test.each(['recommended', 'all'])(
    'private Jest lint installation reports a focused Bun test at %s and accepts its correction',
    async (level) => {
        await using sandbox = await testdir();
        const focused =
            "import { test, expect } from 'bun:test';\n\ntest.only('parses a URL', () => {\n    const parsed = new URL('https://example.com/docs');\n    expect(parsed.hostname, 'The URL keeps its host.').toBe('example.com');\n    expect(parsed.pathname).toBe('/docs');\n});\n";
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n[runner]\ntool = "mise"\n[rules]\ninstall = false\n[tools.jest]\nglobal_package = "bun:test"\n`,
            'package.json': '{"name":"jest-private-lint","private":true,"type":"module"}\n',
            'sample.test.js': focused,
        });
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const command = ['check', '--only', 'javascript/eslint', '--no-cache', '--json'];
        const failed = await run(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks.flatMap((check) => check.findings)).toContainEqual(
            expect.objectContaining({ rule: 'jest/no-focused-tests', file: 'sample.test.js', line: 3 }),
        );
        await Bun.write(join(sandbox.path, 'sample.test.js'), focused.replace('test.only(', 'test('));
        const passing = await run(sandbox.path, command);
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(passing.stdout)).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 5,
);

test.each(['recommended', 'all'])(
    'native Jest at %s applies nested coverage settings without executing sibling tests',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[[scope]]\npath = "app"\nconfigurations = ["jest"]\n[scope.tools.jest]\ncoverage_functions = 100\n`,
            'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
            'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
            'app/package.json': '{"name":"jest-nested","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
            'app/math.cjs': source,
            'app/math.test.cjs': planted,
            'app/authored.txt': 'preserved nested source\n',
        });
        const environment = { PATH: `${join(modules, '.bin')}${delimiter}${toolsPath([])}` };
        const command = ['check', '--stage', 'push', '--only', 'jest/coverage', '--no-cache', '--json'];
        const uncovered = await run(sandbox.path, command, environment);
        expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
        const report = reportSchema.parse(JSON.parse(uncovered.stdout));
        expect(report.checks).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'fail' }]);
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
            expect.objectContaining({ rule: 'coverage-functions', message: expect.stringContaining('100% floor') }),
        );
        await Bun.write(join(sandbox.path, 'app/math.test.cjs'), corrected);
        const passing = await run(sandbox.path, command, environment);
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(passing.stdout)).checks).toMatchObject([
            { check: 'jest/coverage', scope: 'app', status: 'ok', findings: [] },
        ]);
        expect(reportSchema.parse(JSON.parse(passing.stdout)).checks.flatMap((check) => check.findings)).toStrictEqual(
            [],
        );
        expect(readFileSync(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
    },
    PLANTED_TIMEOUT_MS * 2,
);

test.each(['recommended', 'all'])(
    'native Jest at %s reports uncovered functions and failed tests while preserving working-tree files',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n`,
            'package.json': '{"name":"jest-acceptance","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
            'math.cjs': source,
            'math.test.cjs': planted,
            'authored.txt': 'preserved source\n',
            'coverage/authored.txt': 'preserved report\n',
        });
        const environment = { PATH: `${join(modules, '.bin')}${delimiter}${toolsPath([])}` };
        const command = ['check', '--stage', 'push', '--only', 'jest/coverage', '--no-cache', '--json'];
        const uncovered = await run(sandbox.path, command, environment);
        expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
        expect(
            reportSchema.parse(JSON.parse(uncovered.stdout)).checks.flatMap((check) => check.findings),
        ).toStrictEqual([
            expect.objectContaining({ rule: 'coverage-lines' }),
            expect.objectContaining({
                check: 'jest/coverage',
                rule: 'coverage-functions',
                message: expect.stringContaining('50%'),
            }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected);
        const passing = await run(sandbox.path, command, environment);
        expect(passing.code, passing.stdout + passing.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(passing.stdout)).checks).toMatchObject([
            { check: 'jest/coverage', status: 'ok', findings: [] },
        ]);
        expect(reportSchema.parse(JSON.parse(passing.stdout)).checks.flatMap((check) => check.findings)).toStrictEqual(
            [],
        );
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected.replace('toBe(6)', 'toBe(7)'));
        const failed = await run(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(failed.stdout)).checks.flatMap((check) => check.findings)).toStrictEqual([
            expect.objectContaining({ rule: 'test-failure', file: 'math.test.cjs', line: 4 }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), 'require("./missing-test-dependency.cjs");\n');
        const unavailable = await run(sandbox.path, command, environment);
        expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
        expect(reportSchema.parse(JSON.parse(unavailable.stdout)).checks).toStrictEqual([
            expect.objectContaining({ check: 'jest/coverage', status: 'error' }),
        ]);
        await Bun.write(join(sandbox.path, 'math.test.cjs'), corrected);
        const recovered = await run(sandbox.path, command, environment);
        expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(recovered.stdout)).checks).toMatchObject([
            { check: 'jest/coverage', status: 'ok', findings: [] },
        ]);
        expect(readFileSync(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
        expect(readFileSync(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
        expect(readFileSync(join(sandbox.path, 'math.cjs'), 'utf8')).toBe(source);
    },
    PLANTED_TIMEOUT_MS * 4,
);
