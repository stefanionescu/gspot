// A planted Svelte component with loose markup: Prettier reads it through prettier-plugin-svelte, reports it, and corrects it.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/samples/components.ts';

const FORMATTED =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p class="greeting">{name}</p>\n';

const LOOSE = FORMATTED.replace('<p class=', () => '<p     class=');

test(
    'formatting/prettier reports and corrects a Svelte component through the Svelte plugin',
    async () => {
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            kits: ['typescript', 'svelte', 'formatting'],
            dependencies: { svelte: '5.57.0' },
            files: {
                'tsconfig.json': COMPONENT_TSCONFIG,
                'src/answer.ts': COMPONENT_SOURCE,
                'src/Greeting.svelte': LOOSE,
            },
        });
        const loose = await spawnGspot(sandbox.path, ['check', '--only', 'formatting/prettier', '--json'], environment);
        expect(loose.code, loose.stdout + loose.stderr).toBe(1);
        const [check] = (JSON.parse(loose.stdout) as RunReport).checks;
        expect(check).toMatchObject({ check: 'formatting/prettier', status: 'fail' });
        expect(check!.findings).toContainEqual(containing({ file: 'src/Greeting.svelte' }));
        const fixed = await spawnGspot(sandbox.path, ['check', '--fix', '--only', 'formatting/prettier'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'src/Greeting.svelte')).text()).toBe(FORMATTED);
    },
    PLANTED_TIMEOUT_MS * 6,
);
