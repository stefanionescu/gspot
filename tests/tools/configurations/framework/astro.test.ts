// Test Astro components: ESLint reads their markup, astro check their types, and Prettier their layout.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { prepareTestRepository } from '#tests/harness/repository.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/config/samples/components.ts';
import { PAGE, CLEAN, BUNDLED } from '#tests/config/tools/configurations/framework/astro.ts';

test(
    'one Astro project reaches ESLint, astro check, and Prettier, and accepts each correction',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        const environment = await prepareTestRepository(root, {
            configurations: ['typescript', 'astro', 'format'],
            dependencies: { astro: '7.3.2' },
            tsconfig: COMPONENT_TSCONFIG,
            files: { 'src/answer.ts': COMPONENT_SOURCE, [PAGE]: CLEAN },
        });
        const linted = await runCheckCase(
            root,
            { check: 'javascript/eslint', files: { [PAGE]: BUNDLED } },
            environment,
        );
        expect(linted.code, linted.stdout + linted.stderr).toBe(1);
        const findings = (JSON.parse(linted.stdout) as RunReport).checks[0]!.findings;
        expect(findings).toContainEqual(containing({ rule: 'astro/no-set-html-directive', file: PAGE, line: 8 }));
        const rules = new Set(findings.map((finding) => finding.rule));
        expect(
            ['@typescript-eslint/no-unsafe-return', 'gspot/no-trivial-files'].filter((name) => rules.has(name)),
        ).toStrictEqual([]);
        const typed = await runCheckCase(
            root,
            { check: 'astro/check', files: { [PAGE]: CLEAN.replace('const title: string', 'const title: number') } },
            environment,
        );
        expect(typed.code, typed.stdout + typed.stderr).toBe(1);
        expect((JSON.parse(typed.stdout) as RunReport).checks[0]!.findings).toContainEqual(
            containing({ rule: 'ts(2322)', file: PAGE, line: 2, column: 7 }),
        );
        await Bun.write(join(root, PAGE), CLEAN.replace('<h1>{title}</h1>', '<h1>{title}</h1   >'));
        const loose = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json'], environment);
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        const fixed = await spawnGspot(root, ['check', '--fix', '--only', 'format/prettier'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, PAGE)).text()).toBe(CLEAN);
        const clean = await spawnGspot(
            root,
            ['check', '--json', '--only', 'javascript/eslint', 'astro/check'],
            environment,
        );
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
