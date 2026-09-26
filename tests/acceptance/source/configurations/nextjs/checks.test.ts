// Planted repository for the nextjs and i18n configurations: a segment that serves two things, a build check turned off, versions apart, and message files with holes.
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/support/cli/command.ts';
import { installedNextProject, nextManifest, NEXT_PAGE, NEXT_TRANSLATIONS } from '#tests/support/cli/nextjs.ts';

const CASES: FindingCase[] = [
    {
        check: 'integrity/route-segments',
        files: {
            'app/route.ts':
                '// Answers the same address as the page.\n\n/**\n * Answers a request.\n * @returns the answer\n */\nexport function GET(): Response {\n    return new Response("ok");\n}\n',
        },
        expected: { file: 'app/route.ts', rule: 'route-segment', line: 1 },
    },
    {
        check: 'integrity/next-config',
        files: {
            'next.config.mjs':
                '// The framework configuration.\nconst config = { eslint: { ignoreDuringBuilds: true } };\n\nexport default config;\n',
        },
        expected: { file: 'next.config.mjs', rule: 'build-check-off', line: 2 },
    },
    {
        check: 'integrity/dependency-alignment',
        files: { 'package.json': nextManifest('18.3.1') },
        expected: { file: 'package.json', rule: 'version-pair', line: 1 },
    },
    {
        check: 'nextjs/typecheck',
        files: {
            'app/count.ts':
                '// A planted file.\n\n/** A number that holds text. */\nexport const count: number = "three";\n',
        },
        expected: { file: 'app/count.ts', rule: 'TS2322', line: 4 },
    },
    {
        check: 'nextjs/build',
        files: { 'app/page.tsx': NEXT_PAGE.replace('return "home";', 'return missing;') },
        // Turbopack refuses the linked node_modules folder of a planted repository, so the sandbox builds with webpack.
        policy: '[tools.next]\nbuild_in_gate = true\nbuild_flags = ["--webpack"]\n',
        expected: { file: 'package.json', rule: 'build', line: 1 },
    },
    {
        check: 'i18n/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start" }\n}\n' },
        policy: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'missing-key', line: 1 },
    },
    {
        check: 'i18n/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name" }\n}\n' },
        policy: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'message', line: 1 },
    },
];

test.each(CASES)(
    '$check reports $expected.rule in $expected.file and accepts a correction',
    async (planted) => {
        const prepared = await installedNextProject();
        await using sandbox = prepared.sandbox;
        const environment = prepared.environment;
        const outcome = await runPlanted(sandbox.path, planted, environment);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
        expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
        expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
        const files: Record<string, string> = {};
        if (planted.check === 'integrity/route-segments') files['app/api/route.ts'] = planted.files['app/route.ts']!;
        if (planted.check === 'nextjs/typecheck')
            files['app/count.ts'] = planted.files['app/count.ts']!.replace('"three"', '3');
        const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const accepted = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
        expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
    },
    PLANTED_TIMEOUT_MS * 6,
);
