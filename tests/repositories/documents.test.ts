// Planted repository for the markdown, docs and prose presets: every check fires on its planted defect.

import { join } from 'node:path';
// The Vale packages of this repository are linked in, so the prose check runs offline.
import { fileURLToPath } from 'node:url';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const STYLES = join(root, '.gspot', 'vale', 'styles');
const OWN_STYLES = new Set(['gspot', 'config']);

const README = `# planted

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
const GUIDE = '# The guide\n\nThe worker retries the request three times. Each retry waits one second.\n';
const LICENSE = 'MIT License\n\nCopyright (c) 2026 Alex Garcia\n';

const CASES: PlantedCase[] = [
    {
        id: 'markdown/markdownlint',
        files: { 'docs/skipped.md': '# A page\n\n### A heading two levels down\n\nText under it.\n' },
        expected: 'MD001',
    },
    {
        id: 'markdown/fences',
        files: { 'docs/fence.md': '# A page\n\n```json\n{ "open": \n```\n' },
        expected: 'docs/fence.md',
    },
    {
        id: 'docs/links',
        files: { 'docs/linked.md': '# A page\n\nRead [the other page](missing-page.md) first.\n' },
        expected: 'missing-page.md',
    },
    {
        id: 'integrity/docs-headings',
        files: { 'docs/layout.md': '# A page\n\n## Project structure\n\nOne folder for each thing.\n' },
        expected: 'promises an inventory',
    },
    {
        id: 'integrity/stale-paths',
        files: { 'docs/stale.md': '# A page\n\nThe entry point is `docs/nowhere/start.md`.\n' },
        expected: 'docs/nowhere/start.md names no tracked file or folder',
    },
    { id: 'docs/readme-present', files: {}, removed: ['LICENSE'], expected: 'The root has no LICENSE file' },
    {
        id: 'docs/readme-shape',
        files: { 'README.md': '# planted\n\nText with no section at all.\n' },
        expected: 'README.md',
    },
    {
        id: 'prose/vale',
        files: { 'docs/selling.md': '# A page\n\nThis powerful cache easily makes the application much faster.\n' },
        expected: 'docs/selling.md',
    },
    {
        id: 'prose/source-bans',
        files: { 'docs/silenced.md': '# A page\n\n<!-- vale off -->\n\nText the prose check no longer reads.\n' },
        expected: 'A Vale directive turns a rule off in the text',
    },
];

const REPORTED_ELSEWHERE = ['markdown/prettier', 'prose/messages', 'prose/doc-tags'];

function linkValePackages(target: string): void {
    const styles = join(target, '.gspot', 'vale', 'styles');
    mkdirSync(styles, { recursive: true });
    for (const name of readdirSync(STYLES))
        if (!OWN_STYLES.has(name)) symlinkSync(join(STYLES, name), join(styles, name));
    mkdirSync(join(styles, 'config'), { recursive: true });
    symlinkSync(join(STYLES, 'config', 'dictionaries'), join(styles, 'config', 'dictionaries'));
}

describe.skipIf(!existsSync(join(STYLES, 'Google')))('the markdown, docs and prose presets', () => {
    test(
        'every check passes on clean documents and fires on its planted defect',
        async () => {
            await using fixture = await createFixture({
                'README.md': README,
                'docs/guide.md': GUIDE,
                'docs/second.md': GUIDE,
                '.gitignore': 'node_modules/\n',
                LICENSE,
            });
            symlinkSync(join(root, 'node_modules'), join(fixture.path, 'node_modules'), 'dir');
            commitAll(fixture.path);
            linkValePackages(fixture.path);
            const environment = { PATH: toolsPath(['vale', 'lychee', 'markdownlint-cli2', 'typos', 'ec']) };
            run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'markdown,prose',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--hooks',
                    'none',
                    '--no-rules',
                    '--no-install',
                    '--allow-dirty',
                ],
                environment,
            );
            const whole = run(fixture.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            // A check id is written like a path. A document that names one means the check, whatever folders exist.
            const named = await runPlanted(
                fixture.path,
                {
                    id: 'integrity/stale-paths',
                    files: { 'docs/checks.md': '# A page\n\nThe check `docs/links` reads every link.\n' },
                    expected: '',
                },
                environment,
            );
            expect(named.code, named.stdout).toBe(0);
            for (const id of REPORTED_ELSEWHERE) {
                const skipped = run(fixture.path, ['check', id], environment);
                expect(skipped.stdout, id).toContain('its findings come from');
            }
            rmSync(join(fixture.path, '.gspot', 'vale', 'styles', 'config', 'dictionaries'));
            const broken = run(fixture.path, ['check', 'prose/vale', '--no-cache'], environment);
            expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(1);
            expect(broken.stdout).toContain('error');
            const record = JSON.parse(run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout) as {
                checks: { id: string }[];
            };
            expect(record.checks.map((check) => check.id)).not.toContain('docs/links-external');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
