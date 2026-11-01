import { testdir } from 'testdirs';
import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each(['html/html-validate', 'site/html-validate'])(
    'an ignore for %s turns valid-id off only in its own html-validate file',
    async (check) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['html', 'site'], {
                level: 'all',
                tables: `[[ignore]]\ncheck = "${check}"\nrule = "valid-id"\nreason = "The external validator checks identifier syntax."\n`,
            }),
            'index.html': '<!doctype html><title>Root</title>',
        });

        const output = buildGeneratedFiles(await openSession(sandbox.path));
        for (const [name, selected] of [
            ['html', 'html/html-validate'],
            ['site', 'site/html-validate'],
        ] as const) {
            const file = output.files.find(({ path }) => path.endsWith(`/${name}/html-validate.json`))!;
            if (selected !== check && name === 'html') expect(parse(file.content)).not.toHaveProperty('rules.valid-id');
            else
                expect(parse(file.content)).toMatchObject({
                    rules: { 'valid-id': selected === check ? 'off' : ['error', { relaxed: true }] },
                });
        }
    },
);
