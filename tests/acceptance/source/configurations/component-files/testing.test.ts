// Planted Testing Library defects in component repositories: a debugging call fails in a test file and nowhere else.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';

const LIBRARIES = [
    { framework: 'vue', library: '@testing-library/vue', dependencies: { vue: vueManifest.version } },
    { framework: 'svelte', library: '@testing-library/svelte', dependencies: { svelte: '5.57.0' } },
];

describe('the Testing Library rules of component frameworks', () => {
    test.each(LIBRARIES)(
        '$framework reports a debugging call in a test file and nowhere else',
        async ({ framework, library, dependencies }) => {
            await using sandbox = await testdir();
            const environment = await installSandbox(sandbox.path, {
                configurations: ['javascript', framework],
                dependencies,
                files: {},
            });
            const opening = `// A planted test.\nimport { render, screen } from '${library}';\n\nrender({});\n`;
            const debugged = `${opening}screen.debug();\n`;
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'javascript/eslint', files: { 'src/greeting.test.js': debugged } },
                environment,
            );
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const report = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(report.checks[0]!.findings).toContainEqual(
                containing({
                    rule: 'testing-library/no-debugging-utils',
                    file: 'src/greeting.test.js',
                    line: 5,
                }),
            );
            await runPlanted(
                sandbox.path,
                { check: 'javascript/eslint', files: { 'src/debugging.js': debugged } },
                environment,
            );
            const outside = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(
                outside.checks
                    .flatMap(({ findings }) => findings)
                    .filter(({ rule }) => rule?.startsWith('testing-library/') === true),
            ).toStrictEqual([]);
            await Bun.write(join(sandbox.path, 'src/greeting.test.js'), `${opening}screen.getByText('hello');\n`);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'javascript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
