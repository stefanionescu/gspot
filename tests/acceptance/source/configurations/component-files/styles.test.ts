// Planted style blocks of component files: stylelint reads them through postcss-html and knows the scoping pseudo-classes of each framework.
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

const STYLES = [
    {
        framework: 'vue',
        dependencies: { vue: vueManifest.version },
        path: 'src/Card.vue',
        text: '<template>\n    <p class="card"><span class="title">card</span></p>\n</template>\n\n<style scoped>\n.card :deep(.title) {\n    color: #ggg;\n}\n</style>\n',
        line: 7,
    },
    {
        framework: 'svelte',
        dependencies: { svelte: '5.57.0' },
        path: 'src/Card.svelte',
        text: '<p class="card">card</p>\n\n<style>\n    :global(.card) {\n        color: #ggg;\n    }\n</style>\n',
        line: 5,
    },
];

describe('component style blocks', () => {
    test.each(STYLES)(
        'css/stylelint reads the style block of $path',
        async ({ framework, dependencies, path, text, line }) => {
            await using sandbox = await testdir();
            const environment = await installSandbox(sandbox.path, {
                configurations: ['javascript', framework, 'css'],
                dependencies,
                files: {},
            });
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'css/stylelint', files: { [path]: text } },
                environment,
            );
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const findings = reportSchema
                .parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json())
                .checks.flatMap((check) => check.findings);
            expect(findings).toContainEqual(
                containing({ rule: 'declaration-property-value-no-unknown', file: path, line }),
            );
            expect(findings.map(({ rule }) => rule)).not.toContain('selector-pseudo-class-no-unknown');
            await Bun.write(join(sandbox.path, path), text.replace('#ggg', '#abc'));
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'css/stylelint', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
