// Planted repository for the structure configuration: each repository-shape check fires on its planted defect.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { git } from '#tests/harness/cli/git.ts';
import { run } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { script, plantedCases } from '#tests/harness/planted/cases.ts';
import { KILOBYTE, OVER_LIMIT_KB } from '#tests/inputs/acceptance/source/kits/kits.ts';

const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');

plantedCases(
    'the structure configuration',
    {
        kits: ['bash', 'javascript'],
        modules: false,
        without: [],
        init: ['--no-ci', '--no-guides', '--no-install'],
        tools: ['shellcheck', 'shfmt'],
        // The npm lock makes npm the runner init takes.
        files: {
            'scripts/a.sh': CLEAN,
            'scripts/b.sh': CLEAN,
            'package.json': '{"private":true}\n',
            'package-lock.json': '{"lockfileVersion":3,"requires":true,"packages":{}}\n',
        },
        prepare: async (root, environment) => {
            const reasons = await run(root, ['set', 'require_reasons', 'true'], environment);
            if (reasons.code !== 0) throw new Error(`Reasons were not required: ${reasons.stdout}${reasons.stderr}`);
        },
    },
    [
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
        // JavaScript folders report through the same check; the ESLint plugin has no rule of its own for them.
        {
            check: 'structure/single-file-folder',
            files: { 'feature/only.js': 'export const only = 1;\n' },
            expected: { file: 'feature/only.js', rule: 'lone-file', line: 1 },
        },
        {
            check: 'structure/prefix-collisions',
            files: {
                'cards/asset-card.js': 'export const card = 1;\n',
                'cards/asset-list.js': 'export const list = 1;\n',
                'cards/asset-row.js': 'export const row = 1;\n',
            },
            expected: { file: 'cards/asset-card.js', rule: 'shared-prefix', line: 1 },
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
                    '    echo "${greeting}"',
                    () => '    # shellcheck disable=SC2086\n    echo "${greeting}"',
                ),
            },
            expected: { file: 'scripts/quiet.sh', rule: 'shellcheck-no-reason', line: 12 },
        },
        {
            check: 'integrity/allowlists-match',
            files: {},
            policy: '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["nowhere/**"]\nreason = "A pattern that matches no file here."\n',
            expected: { file: 'gspot.toml', rule: 'unmatched-pattern', line: 1 },
            corrected: { files: {}, policy: undefined },
        },
        {
            check: 'integrity/large-files',
            files: { 'notes/big.txt': 'x'.repeat(OVER_LIMIT_KB * KILOBYTE) },
            expected: { file: 'notes/big.txt', rule: 'over-limit', line: 1 },
        },
    ],
    (planted) => {
        test(
            'integrity/tracked-dependencies reports a dependency folder that git tracks',
            async () => {
                const { root, environment } = planted();
                const command = ['check', '--only', 'integrity/tracked-dependencies', '--json'];
                const clean = await run(root, command, environment);
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
                mkdirSync(join(root, 'web', 'node_modules', 'left-pad'), { recursive: true });
                await Bun.write(join(root, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
                expect(git(root, ['add', '-f', 'web/node_modules/left-pad/index.js']).code).toBe(0);
                const tracked = await run(root, command, environment);
                expect(tracked.code).toBe(1);
                expect((JSON.parse(tracked.stdout) as RunReport).checks).toMatchObject([
                    {
                        check: 'integrity/tracked-dependencies',
                        status: 'fail',
                        findings: [{ file: 'web/node_modules', rule: 'tracked-folder', line: 1 }],
                    },
                ]);
                expect(git(root, ['rm', '-r', '--cached', '--quiet', 'web/node_modules']).code).toBe(0);
                const corrected = await run(root, command, environment);
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                    { check: 'integrity/tracked-dependencies', status: 'ok', findings: [] },
                ]);
            },
            PLANTED_TIMEOUT_MS,
        );
    },
);
