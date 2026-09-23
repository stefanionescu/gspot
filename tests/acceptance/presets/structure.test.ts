// Planted repository for the structure preset: each repository-shape check fires on its planted defect.
import type { RunReport } from '#cli/output/report-types.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { runPlanted, script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'npm', '--no-ci', '--no-rules', '--no-install'];
const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');
const KILOBYTE = 1024;
const OVER_LIMIT_KB = 1100;

const CASES: FindingCase[] = [
    {
        check: 'structure/single-file-folder',
        files: { 'tools/only/one.sh': CLEAN },
        expected: { file: 'tools/only/one.sh', rule: 'lone-file', line: 1 },
    },
    {
        check: 'structure/prefix-collisions',
        files: { 'jobs/asset-card.sh': CLEAN, 'jobs/asset-list.sh': CLEAN, 'jobs/asset-row.sh': CLEAN },
        expected: { file: 'jobs/asset-card.sh', rule: 'shared-prefix', line: 1 },
    },
    {
        check: 'structure/file-directory-collision',
        files: { 'jobs/turn.sh': CLEAN, 'jobs/turn/first.sh': CLEAN, 'jobs/turn/second.sh': CLEAN },
        expected: { file: 'jobs/turn.sh', rule: 'stem-collision', line: 1 },
    },
    {
        check: 'structure/folder-names',
        files: { 'helpers/first.sh': CLEAN, 'helpers/second.sh': CLEAN },
        expected: { file: 'helpers/first.sh', rule: 'container-name', line: 1 },
    },
    {
        check: 'integrity/suppressions',
        files: {
            'scripts/quiet.sh': CLEAN.replace(
                '    echo "hello $1"',
                () => '    # shellcheck disable=SC2086\n    echo "hello $1"',
            ),
        },
        expected: { file: 'scripts/quiet.sh', rule: 'shellcheck-no-reason', line: 11 },
    },
    {
        check: 'integrity/allowlists-match',
        files: {},
        policy: '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["nowhere/**"]\nreason = "A pattern that matches no file here."\n',
        expected: { file: 'gspot.toml', rule: 'unmatched-pattern', line: 1 },
    },
    {
        check: 'integrity/large-files',
        files: { 'notes/big.txt': 'x'.repeat(OVER_LIMIT_KB * KILOBYTE) },
        expected: { file: 'notes/big.txt', rule: 'over-limit', line: 1 },
    },
    {
        check: 'integrity/task-policy',
        files: { 'package.json': '{"private":true,"scripts":{"gspot:check":"echo nothing"}}\n' },
        expected: { file: 'package.json', rule: 'missing-task', line: 1 },
    },
];

describe('the structure preset', () => {
    test(
        'every repository-shape check passes on a clean repository and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': CLEAN,
                'scripts/b.sh': CLEAN,
                'package.json': '{"private":true}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(sandbox.path, [...INIT, '--hooks', 'gspot'], environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const reasons = await run(sandbox.path, ['set', 'require_reasons', 'true'], environment);
            expect(reasons.code, reasons.stdout + reasons.stderr).toBe(0);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check} on the clean repository: ${clean.stdout}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                const report = JSON.parse(await Bun.file(join(sandbox.path, '.gspot/report.json')).text()) as RunReport;
                const result = report.checks.find((entry) => entry.check === planted.check);
                expect(result?.status, outcome.stdout).toBe('fail');
                const finding = result?.findings.find(
                    (entry) => entry.file === planted.expected.file && entry.rule === planted.expected.rule,
                );
                expect(finding).toMatchObject({ check: planted.check, ...planted.expected });
            }
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test(
        'integrity/tracked-dependencies reports a dependency folder that git tracks',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN, 'scripts/b.sh': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(sandbox.path, [...INIT, '--no-hooks'], environment);
            const clean = await run(sandbox.path, ['check', '--only', 'integrity/tracked-dependencies'], environment);
            expect(clean.code).toBe(0);
            mkdirSync(join(sandbox.path, 'web', 'node_modules', 'left-pad'), { recursive: true });
            await Bun.write(join(sandbox.path, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
            git(sandbox.path, ['add', '-f', 'web/node_modules/left-pad/index.js']);
            const check = await run(
                sandbox.path,
                ['check', '--only', 'integrity/tracked-dependencies', '--no-cache'],
                environment,
            );
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('git tracks 1 file(s) under web/node_modules/');
        },
        PLANTED_TIMEOUT_MS,
    );
});
