// Planted repository for the markdown, docs and prose presets: every check fires on its planted defect.

import { join } from 'node:path';
// Copy the installed Vale packages so the fixture has private offline styles.
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import type { RunReport } from '#cli/output/report-types.ts';
import { describe, expect, test } from 'bun:test';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { cpSync, mkdirSync, readdirSync, symlinkSync, rmSync } from 'node:fs';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/support/cli/planted.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const STYLES = join(root, '.gspot', 'vale', 'styles');
const OWN_STYLES = new Set(['gspot', 'config']);

const README = `# Planted

A planted repository that holds documents and nothing else.

## Requirements

- git

## Setup

\`\`\`bash
git clone https://example.com/planted.git
\`\`\`

## Usage

Open the guide and read it from the top.
`;
const GUIDE = '# The Guide\n\nThe worker retries the request three times. Each retry waits one second.\n';
const LICENSE = 'MIT License\n\nCopyright (c) 2026 Alex Garcia\n';

const CASES: FindingCase[] = [
    {
        check: 'markdown/markdownlint',
        files: { 'docs/skipped.md': '# A page\n\n### A heading two levels down\n\nText under it.\n' },
        expected: { file: 'docs/skipped.md', rule: 'MD001', line: 3 },
    },
    {
        check: 'markdown/fences',
        files: { 'docs/fence.md': '# A page\n\n```json\n{ "open": \n```\n' },
        expected: { file: 'docs/fence.md', rule: 'json', line: 3 },
    },
    {
        check: 'docs/links',
        files: { 'docs/linked.md': '# A page\n\nRead [the other page](missing-page.md) first.\n' },
        expected: { file: 'docs/linked.md', rule: 'ERROR', line: 3, column: 6 },
    },
    {
        check: 'integrity/docs-headings',
        files: { 'docs/layout.md': '# A page\n\n## Project structure\n\nOne folder for each thing.\n' },
        expected: { file: 'docs/layout.md', rule: 'banned-heading', line: 3 },
    },
    {
        check: 'integrity/stale-paths',
        files: { 'docs/stale.md': '# A page\n\nThe entry point is `docs/nowhere/start.md`.\n' },
        expected: { file: 'docs/stale.md', rule: 'missing-path', line: 3 },
    },
    {
        check: 'docs/readme-present',
        files: {},
        removed: ['LICENSE'],
        expected: { file: 'LICENSE', message: 'The root has no LICENSE file.' },
    },
    {
        check: 'docs/readme-shape',
        files: { 'README.md': '# planted\n\nText with no section at all.\n' },
        expected: { file: 'README.md', rule: 'start-section', line: 1 },
    },
    {
        check: 'prose/vale',
        files: { 'docs/selling.md': '# A page\n\nThis powerful cache easily makes the application much faster.\n' },
        expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
    },
    {
        check: 'prose/source-bans',
        files: { 'docs/silenced.md': '# A page\n\n<!-- vale off -->\n\nText the prose check no longer reads.\n' },
        expected: { file: 'docs/silenced.md', rule: 'vale-directive', line: 3 },
    },
];

const REPORTED_ELSEWHERE = ['markdown/prettier', 'prose/messages', 'prose/doc-tags'];

function copyValePackages(target: string): void {
    const styles = join(target, '.gspot', 'vale', 'styles');
    mkdirSync(styles, { recursive: true });
    for (const name of readdirSync(STYLES))
        if (!OWN_STYLES.has(name))
            cpSync(join(STYLES, name), join(styles, name), { recursive: true, dereference: true });
    mkdirSync(join(styles, 'config'), { recursive: true });
    cpSync(join(STYLES, 'config', 'dictionaries'), join(styles, 'config', 'dictionaries'), {
        recursive: true,
        dereference: true,
    });
}

describe('the markdown, docs and prose presets', () => {
    test(
        'every check passes on clean documents and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'README.md': README,
                'docs/guide.md': GUIDE,
                'docs/second.md': GUIDE,
                '.gitignore': 'node_modules/\n',
                LICENSE,
            });
            symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
            commitAll(sandbox.path);
            copyValePackages(sandbox.path);
            const environment = { PATH: toolsPath(['vale', 'lychee', 'markdownlint-cli2', 'typos', 'ec']) };
            await install(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'markdown',
                    'prose',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                    '--allow-dirty',
                ],
                environment,
            );
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const whole = await run(sandbox.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            for (const planted of CASES) {
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
            // A check id is written like a path. A document that names one means the check, whatever folders exist.
            const named = await runPlanted(
                sandbox.path,
                {
                    check: 'integrity/stale-paths',
                    files: { 'docs/checks.md': '# A page\n\nThe check `docs/links` reads every link.\n' },
                },
                environment,
            );
            expect(named.code, named.stdout).toBe(0);
            for (const id of REPORTED_ELSEWHERE) {
                const skipped = await run(sandbox.path, ['check', '--only', id], environment);
                expect(skipped.stdout, id).toContain('its findings come from');
            }
            rmSync(join(sandbox.path, '.gspot', 'vale', 'styles', 'config', 'dictionaries'), { recursive: true });
            const broken = await run(sandbox.path, ['check', '--only', 'prose/vale', '--no-cache'], environment);
            expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
            expect(broken.stdout).toContain('error');
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const record = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(record.checks.map((check) => check.check)).not.toContain('docs/links-external');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
