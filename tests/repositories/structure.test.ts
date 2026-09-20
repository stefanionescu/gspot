// Planted repository for the structure preset: each repository-shape check fires on its planted defect.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, git, PLANTED_TIMEOUT_MS, run, runPlanted, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = ['init', '--yes', '--presets', 'bash', '--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];
const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');
const KILOBYTE = 1024;
const OVER_LIMIT_KB = 1100;
const STALE_BASELINE = '{"check":"gone/check","rule":"all","count":1,"recorded":"2026-01-01","paths":{}}\n';

const CASES: PlantedCase[] = [
    { check: 'structure/single-file-folder', files: { 'tools/only/one.sh': CLEAN }, expected: 'holds only one.sh' },
    {
        check: 'structure/prefix-collisions',
        files: { 'jobs/asset-card.sh': CLEAN, 'jobs/asset-list.sh': CLEAN, 'jobs/asset-row.sh': CLEAN },
        expected: 'share the prefix "asset"',
    },
    {
        check: 'structure/file-directory-collision',
        files: { 'jobs/turn.sh': CLEAN, 'jobs/turn/first.sh': CLEAN, 'jobs/turn/second.sh': CLEAN },
        expected: 'turn',
    },
    {
        check: 'structure/folder-names',
        files: { 'helpers/first.sh': CLEAN, 'helpers/second.sh': CLEAN },
        expected: 'helpers',
    },
    {
        check: 'integrity/baselines-current',
        files: { '.gspot/baselines/gone.check.all.json': STALE_BASELINE },
        expected: 'names a check that does not run here',
    },
    {
        check: 'integrity/suppressions',
        files: {
            'scripts/quiet.sh': CLEAN.replace(
                '    echo "hello $1"',
                () => '    # shellcheck disable=SC2086\n    echo "hello $1"',
            ),
        },
        expected: 'carries no reason',
    },
    {
        check: 'integrity/allowlists-match',
        files: {},
        policy: '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["nowhere/**"]\nreason = "A pattern that matches no file here."\n',
        expected: 'nowhere/** under [[ignore]] matches no tracked file or folder',
    },
    {
        check: 'integrity/large-files',
        files: { 'notes/big.txt': 'x'.repeat(OVER_LIMIT_KB * KILOBYTE) },
        expected: 'is over the 1024 KB limit',
    },
    {
        check: 'integrity/task-policy',
        files: { '.gspot/hooks/pre-commit': '#!/usr/bin/env bash\necho nothing\n' },
        expected: 'The pre-commit hook is missing or does not call',
    },
];

describe('the structure preset', () => {
    test(
        'every repository-shape check passes on a clean repository and fires on its planted defect',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': CLEAN, 'scripts/b.sh': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(fixture.path, [...INIT, '--hooks', 'gspot'], environment);
            for (const planted of CASES) {
                const clean = await run(fixture.path, ['check', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check} on the clean repository: ${clean.stdout}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test(
        'integrity/tracked-dependencies reports a dependency folder that git tracks',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': CLEAN, 'scripts/b.sh': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(fixture.path, [...INIT, '--hooks', 'none'], environment);
            const clean = await run(fixture.path, ['check', 'integrity/tracked-dependencies'], environment);
            expect(clean.code).toBe(0);
            mkdirSync(join(fixture.path, 'web', 'node_modules', 'left-pad'), { recursive: true });
            await Bun.write(join(fixture.path, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
            git(fixture.path, ['add', '-f', 'web/node_modules/left-pad/index.js']);
            const check = await run(
                fixture.path,
                ['check', 'integrity/tracked-dependencies', '--no-cache'],
                environment,
            );
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('git tracks 1 file(s) under web/node_modules/');
        },
        PLANTED_TIMEOUT_MS,
    );
});
