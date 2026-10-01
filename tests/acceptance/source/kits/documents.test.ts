// Public CLI journeys for document findings and tool failure recovery.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runPlanted, plantedCases } from '#tests/support/cli/planted.ts';
import { GUIDE, README, LICENSE } from '#tests/inputs/acceptance/source/kits/kits.ts';

// What each check accepts in place of its planted document; the guide for the rest.
const CORRECTIONS: Record<string, string> = {
    'docs/links': '# A page\n\nRead [the guide](guide.md) first.\n',
};
const CASES: FindingCase[] = [
    {
        check: 'markdown/markdownlint',
        files: { 'docs/skipped.md': '# A page\n\n### A heading two levels down\n\nText under it.\n' },
        expected: { file: 'docs/skipped.md', rule: 'MD001', line: 3 },
    },
    {
        check: 'docs/links',
        files: { 'docs/linked.md': '# A page\n\nRead [the other page](missing-page.md) first.\n' },
        expected: { file: 'docs/linked.md', rule: 'ERROR', line: 3, column: 6 },
    },
    {
        check: 'docs/readme-present',
        files: {},
        removed: ['LICENSE'],
        expected: { file: 'LICENSE', message: 'The root has no LICENSE file.' },
    },
    {
        check: 'prose/vale',
        files: { 'docs/selling.md': '# A page\n\nThis powerful cache easily makes the application much faster.\n' },
        expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
    },
    {
        check: 'prose/banned',
        files: { 'docs/silenced.md': '# A page\n\n<!-- vale off -->\n\nText the prose check no longer reads.\n' },
        expected: { file: 'docs/silenced.md', rule: 'vale-directive', line: 3 },
    },
];

plantedCases(
    'the markdown, docs and prose configurations',
    {
        kits: ['markdown', 'prose'],
        without: [],
        tools: ['vale', 'lychee', 'markdownlint-cli2'],
        files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
        corrected: (planted) => ({
            files: Object.fromEntries(
                Object.keys(planted.files).map((path) => [path, CORRECTIONS[planted.check] ?? GUIDE]),
            ),
        }),
    },
    CASES,
    (planted) => {
        test(
            'document selection excludes external links and recovers after missing Vale dictionaries',
            async () => {
                const { root: sandbox, environment } = planted();
                // A check id is written like a path. A document that names one means the check, whatever folders exist.
                const named = await runPlanted(
                    sandbox,
                    {
                        check: 'integrity/stale-paths',
                        files: { 'docs/checks.md': '# A page\n\nThe check `docs/links` reads every link.\n' },
                    },
                    environment,
                );
                expect(named.code, named.stdout).toBe(0);
                rmSync(join(sandbox, '.gspot', 'config', 'vale', 'styles', 'config', 'dictionaries'), {
                    recursive: true,
                });
                const broken = await run(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
                expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
                expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
                    { check: 'prose/vale', status: 'error' },
                ]);
                // Apply syncs the missing packages again, which the error message tells the reader to run.
                const synced = await run(sandbox, ['apply'], environment);
                expect(synced.code, synced.stdout + synced.stderr).toBe(0);
                const corrected = await run(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
                    { check: 'prose/vale', status: 'ok', findings: [] },
                ]);
                const checked = await run(sandbox, ['check', '--stage', 'commit', '--json'], environment);
                const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
                expect(ids).not.toContain('docs/links-external');
            },
            PLANTED_TIMEOUT_MS * 4,
        );
    },
);
