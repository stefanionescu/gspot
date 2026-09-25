// A planted Svelte component with loose markup: Prettier reads it through prettier-plugin-svelte, reports it, and corrects it.
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG, installSandbox } from '#tests/support/cli/sandbox.ts';

const FORMATTED =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p class="greeting">{name}</p>\n';
const LOOSE = FORMATTED.replace('<p class=', () => '<p     class=');

test(
    'formatting/prettier reports and corrects a Svelte component through the Svelte plugin',
    async () => {
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            configurations: ['typescript', 'svelte', 'formatting'],
            dependencies: { svelte: '5.57.0' },
            files: {
                'tsconfig.json': COMPONENT_TSCONFIG,
                'src/answer.ts': COMPONENT_SOURCE,
                'src/Greeting.svelte': LOOSE,
            },
        });
        const loose = await run(
            sandbox.path,
            ['check', '--only', 'formatting/prettier', '--no-cache', '--json'],
            environment,
        );
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        const [check] = reportSchema.parse(JSON.parse(loose.stdout)).checks;
        expect(check).toMatchObject({ check: 'formatting/prettier', status: 'fail' });
        expect(check!.findings).toContainEqual(expect.objectContaining({ file: 'src/Greeting.svelte' }));
        const fixed = await run(
            sandbox.path,
            ['check', '--fix', '--only', 'formatting/prettier', '--no-cache'],
            environment,
        );
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'src/Greeting.svelte')).text()).toBe(FORMATTED);
    },
    PLANTED_TIMEOUT_MS * 6,
);
