import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/gspot-paths.ts';

test.each(['deno.json', 'deno.jsonc'].flatMap((file) => ['', 'apps/api'].map((scope) => ({ file, scope }))))(
    'a Supabase layout with $file in scope $scope installs the Deno rule named by SUPABASE.md',
    async ({ file, scope }) => {
        const prefix = scope === '' ? '' : `${scope}/`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase'], {
                rules: true,
                tables: scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`,
            }),
            [`${prefix}supabase/config.toml`]: 'project_id = "example"\n',
            [`${prefix}supabase/functions/submit-order/index.ts`]: 'export {};\n',
            [`${prefix}supabase/functions/submit-order/${file}`]: '{}\n',
        });
        const session = await openSession(sandbox.path);
        using _resources = session.resources;
        const files = generate(session).files;
        expect(files.map(({ path }) => path)).toContain(
            `${GSPOT_CONFIGURATIONS_PATH}/language/javascript/rules/DENO.md`,
        );
        const supabase = files.find(
            ({ path }) => path === `${GSPOT_CONFIGURATIONS_PATH}/platform/supabase/rules/SUPABASE.md`,
        );
        expect(supabase?.content).toContain('Edge Functions run on Deno; read DENO.md too.');
    },
);
