import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import astroPackage from 'astro/package.json' with { type: 'json' };
import { prepareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/data/checks/component-samples.ts';
import { ASTRO_PAGE, ASTRO_PAGE_PATH, BUNDLED_ASTRO_PAGE } from '#tests/data/integration/checks/astro.ts';

test('ESLint, astro check, and Prettier each report a finding in one Astro project and pass after each fix', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const environment = await prepareInstalledSandbox(root, {
        configurations: ['typescript', 'astro', 'format'],
        dependencies: { astro: astroPackage.version },
        tsconfig: COMPONENT_TSCONFIG,
        files: { 'src/answer.ts': ANSWER_MODULE, [ASTRO_PAGE_PATH]: ASTRO_PAGE },
    });
    const linted = parseCheckReport(
        await runCheckOnChanges(
            root,
            { check: 'javascript/eslint', files: { [ASTRO_PAGE_PATH]: BUNDLED_ASTRO_PAGE } },
            environment,
        ),
    );
    expect(linted.code, linted.stdout + linted.stderr).toBe(1);
    const findings = linted.report.checks[0]!.findings;
    expect(findings).toContainEqual(
        matchFields({ rule: 'astro/no-set-html-directive', file: ASTRO_PAGE_PATH, line: 8 }),
    );
    const rules = new Set(findings.map((finding) => finding.rule));
    expect(
        ['@typescript-eslint/no-unsafe-return', 'gspot/no-trivial-files'].filter((name) => rules.has(name)),
    ).toStrictEqual([]);
    const typed = parseCheckReport(
        await runCheckOnChanges(
            root,
            {
                check: 'astro/astro-check',
                files: { [ASTRO_PAGE_PATH]: ASTRO_PAGE.replace('const title: string', 'const title: number') },
            },
            environment,
        ),
    );
    expect(typed.code, typed.stdout + typed.stderr).toBe(1);
    expect(typed.report.checks[0]!.findings).toContainEqual(
        matchFields({ rule: 'ts(2322)', file: ASTRO_PAGE_PATH, line: 2, column: 7 }),
    );
    await writeFile(join(root, ASTRO_PAGE_PATH), ASTRO_PAGE.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
    const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
    expect(loose.code, loose.stdout + loose.stderr).toBe(1);
    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, ASTRO_PAGE_PATH), 'utf8')).toBe(ASTRO_PAGE);
    const clean = await spawnGspot(
        root,
        ['check', '--json', '--only', 'javascript/eslint,astro/astro-check'],
        environment,
    );
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});
