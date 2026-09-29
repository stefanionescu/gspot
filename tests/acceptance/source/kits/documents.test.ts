// Public CLI journeys for document findings and tool failure recovery.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#tests/support/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { runPlanted, plantedCases } from '#tests/support/cli/planted.ts';
import { GUIDE, README, LICENSE, OWN_STYLES, REPORTED_ELSEWHERE } from '#tests/inputs/acceptance/source/kits/kits.ts';

const root = fileURLToPath(new URL('../../../..', import.meta.url));
const STYLES = join(root, '.gspot', 'config', 'vale', 'styles');
// What each check accepts in place of its planted document; the guide for the rest.
const CORRECTIONS: Record<string, string> = {
    'markdown/fences': '# A page\n\n```json\n{ "open": true }\n```\n',
    'docs/links': '# A page\n\nRead [the guide](guide.md) first.\n',
    'integrity/stale-paths': '# A page\n\nRead `docs/guide.md`.\n',
    'docs/readme-shape': README,
};
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
        // Vale reads the comments of a stylesheet by path, so marketing prose in CSS is a finding too (K-176).
        check: 'prose/vale',
        files: {
            'src/site.css':
                '/* This powerful cache easily makes the site much faster. */\n.site {\n    color: #333;\n}\n',
        },
        expected: { file: 'src/site.css', rule: 'gspot.marketing', line: 1, column: 9 },
    },
    {
        check: 'prose/banned',
        files: { 'docs/silenced.md': '# A page\n\n<!-- vale off -->\n\nText the prose check no longer reads.\n' },
        expected: { file: 'docs/silenced.md', rule: 'vale-directive', line: 3 },
    },
];

// Copy the installed Vale packages so the fixture has private offline styles.
function copyValePackages(target: string): void {
    const styles = join(target, '.gspot', 'config', 'vale', 'styles');
    mkdirSync(styles, { recursive: true });
    for (const name of readdirSync(STYLES))
        if (!OWN_STYLES.includes(name))
            cpSync(join(STYLES, name), join(styles, name), { recursive: true, dereference: true });
    mkdirSync(join(styles, 'config'), { recursive: true });
    cpSync(join(STYLES, 'config', 'dictionaries'), join(styles, 'config', 'dictionaries'), {
        recursive: true,
        dereference: true,
    });
}

plantedCases(
    'the markdown, docs and prose configurations',
    {
        kits: ['markdown', 'prose'],
        without: [],
        tools: ['vale', 'lychee', 'markdownlint-cli2'],
        files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
        before: copyValePackages,
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
                for (const id of REPORTED_ELSEWHERE) {
                    const skipped = await run(sandbox, ['check', '--only', id], environment);
                    expect(skipped.stdout, id).toContain('its findings come from');
                }
                rmSync(join(sandbox, '.gspot', 'config', 'vale', 'styles', 'config', 'dictionaries'), {
                    recursive: true,
                });
                const broken = await run(sandbox, ['check', '--only', 'prose/vale', '--no-cache'], environment);
                expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
                expect(
                    reportSchema.parse(await Bun.file(join(sandbox, '.gspot/reports/report.json')).json()).checks,
                ).toMatchObject([{ check: 'prose/vale', status: 'error' }]);
                copyValePackages(sandbox);
                const corrected = await run(
                    sandbox,
                    ['check', '--only', 'prose/vale', '--no-cache', '--json'],
                    environment,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: 'prose/vale', status: 'ok', findings: [] },
                ]);
                const checked = await run(sandbox, ['check', '--stage', 'commit', '--json'], environment);
                const ids = reportSchema.parse(JSON.parse(checked.stdout)).checks.map((check) => check.check);
                expect(ids).not.toContain('docs/links-external');
            },
            PLANTED_TIMEOUT_MS * 4,
        );
    },
);
