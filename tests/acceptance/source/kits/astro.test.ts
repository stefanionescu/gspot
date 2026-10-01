// Planted Astro components: ESLint reads their markup, astro check their types, and Prettier their layout.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG, PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';

const CLEAN = `---\nconst title: string = 'Home';\n---\n\n<h1>{title}</h1>\n<img src="logo.png" alt="The logo" />\n`;
const PAGE = 'src/pages/index.astro';

// A sandbox with TypeScript and the Astro kit, and one clean page.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The four cases start from the same installed Astro project.
async function astroSandbox(root: string, kits: string[] = []): Promise<Record<string, string>> {
    return installSandbox(root, {
        kits: ['typescript', 'astro', ...kits],
        dependencies: { astro: '7.3.2' },
        files: { 'tsconfig.json': COMPONENT_TSCONFIG, 'src/answer.ts': COMPONENT_SOURCE, [PAGE]: CLEAN },
    });
}

test.each([
    ['astro/jsx-a11y/alt-text', CLEAN.replace(' alt="The logo"', ''), 6],
    ['astro/no-set-html-directive', `${CLEAN}<div set:html={title} />\n`, 7],
    // Astro types the markup a template callback returns as any, and a script that only imports a module is how
    // Astro bundles client code: neither is reported.
    [
        'astro/no-set-html-directive',
        `${CLEAN}{[title].map((text) => <b>{text}</b>)}\n<div set:html={title} />\n<script>\n    import '../answer.ts';\n</script>\n`,
        8,
    ],
])(
    'astro/eslint reports %s and accepts the clean component',
    async (rule, planted, line) => {
        await using sandbox = await testdir();
        const environment = await astroSandbox(sandbox.path);
        const outcome = await runPlanted(
            sandbox.path,
            { check: 'astro/eslint', files: { [PAGE]: planted } },
            environment,
        );
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        expect(report.checks[0]!.findings).toContainEqual(containing({ rule, file: PAGE, line }));
        const rules = new Set(report.checks[0]!.findings.map((finding) => finding.rule));
        expect(
            ['@typescript-eslint/no-unsafe-return', 'gspot/no-trivial-files'].filter((name) => rules.has(name)),
        ).toStrictEqual([]);
        const clean = await run(sandbox.path, ['check', '--only', 'astro/eslint', '--no-cache', '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect((JSON.parse(clean.stdout) as RunReport).checks).toMatchObject([
            { check: 'astro/eslint', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 6,
);

test(
    'astro/check reports a type error in the frontmatter and accepts its correction',
    async () => {
        await using sandbox = await testdir();
        const environment = await astroSandbox(sandbox.path);
        const planted = CLEAN.replace('const title: string', 'const title: number');
        const outcome = await runPlanted(
            sandbox.path,
            { check: 'astro/check', files: { [PAGE]: planted } },
            environment,
        );
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        expect(report.checks[0]!.findings).toContainEqual(
            containing({ rule: 'ts(2322)', file: PAGE, line: 2, column: 7 }),
        );
        const clean = await run(sandbox.path, ['check', '--only', 'astro/check', '--no-cache', '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect((JSON.parse(clean.stdout) as RunReport).checks).toMatchObject([
            { check: 'astro/check', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 6,
);

test(
    'formatting/prettier reports and corrects an Astro component through the Astro plugin',
    async () => {
        await using sandbox = await testdir();
        const environment = await astroSandbox(sandbox.path, ['formatting']);
        await Bun.write(join(sandbox.path, PAGE), CLEAN.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
        const loose = await run(
            sandbox.path,
            ['check', '--only', 'formatting/prettier', '--no-cache', '--json'],
            environment,
        );
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        expect((JSON.parse(loose.stdout) as RunReport).checks[0]!.findings).toContainEqual(containing({ file: PAGE }));
        const fixed = await run(
            sandbox.path,
            ['check', '--fix', '--only', 'formatting/prettier', '--no-cache'],
            environment,
        );
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, PAGE)).text()).toBe(CLEAN);
    },
    PLANTED_TIMEOUT_MS * 6,
);
