import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { checkChanges } from '#tests/setup/sample-checks.ts';
import { prepareInstalledSandbox } from '#tests/setup/sandbox.ts';
import astroPackage from 'astro/package.json' with { type: 'json' };
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { PAGE, ASTRO_PAGE, BUNDLED_ASTRO_PAGE } from '#tests/data/checks/astro.ts';
import { ANSWER_MODULE, COMPONENT_TSCONFIG } from '#tests/data/checks/component-samples.ts';

test('one Astro project reaches ESLint, astro check, and Prettier, and passes after each fix', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    const environment = await prepareInstalledSandbox(root, {
        configurations: ['typescript', 'astro', 'format'],
        dependencies: { astro: astroPackage.version },
        tsconfig: COMPONENT_TSCONFIG,
        files: { 'src/answer.ts': ANSWER_MODULE, [PAGE]: ASTRO_PAGE },
    });
    const linted = parseCheckReport(
        await checkChanges(root, { check: 'javascript/eslint', files: { [PAGE]: BUNDLED_ASTRO_PAGE } }, environment),
    );
    expect(linted.code, linted.stdout + linted.stderr).toBe(1);
    const findings = linted.report.checks[0]!.findings;
    expect(findings).toContainEqual(matchFields({ rule: 'astro/no-set-html-directive', file: PAGE, line: 8 }));
    const rules = new Set(findings.map((finding) => finding.rule));
    expect(
        ['@typescript-eslint/no-unsafe-return', 'gspot/no-trivial-files'].filter((name) => rules.has(name)),
    ).toStrictEqual([]);
    const typed = parseCheckReport(
        await checkChanges(
            root,
            {
                check: 'astro/astro-check',
                files: { [PAGE]: ASTRO_PAGE.replace('const title: string', 'const title: number') },
            },
            environment,
        ),
    );
    expect(typed.code, typed.stdout + typed.stderr).toBe(1);
    expect(typed.report.checks[0]!.findings).toContainEqual(
        matchFields({ rule: 'ts(2322)', file: PAGE, line: 2, column: 7 }),
    );
    await writeFile(join(root, PAGE), ASTRO_PAGE.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
    const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
    expect(loose.code, loose.stdout + loose.stderr).toBe(1);
    const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, PAGE), 'utf8')).toBe(ASTRO_PAGE);
    const clean = await spawnGspot(
        root,
        ['check', '--json', '--only', 'javascript/eslint,astro/astro-check'],
        environment,
    );
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
});
