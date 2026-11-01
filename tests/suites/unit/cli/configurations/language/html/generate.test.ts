import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { HtmlValidate, type ConfigData } from 'html-validate';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(['html/html-validate', 'site/html-validate'])(
    'an ignore for %s turns valid-id off only in its own html-validate file',
    async (check) => {
        await using sandbox = await createGitSandbox({
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
            if (selected === check) expect(parse(file.content)).toHaveProperty('rules.valid-id', 'off');
            else expect(parse(file.content)).not.toHaveProperty('rules.valid-id', 'off');
        }
    },
);

test('source HTML leaves layout to Prettier while built pages keep their existing validation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html', 'site']),
        'index.html':
            '<!doctype html><html lang="en"><head><title>Example</title></head><body><DIV CLASS=sample>Example</DIV></body></html>',
    });
    const outputs = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const source =
        '<!doctype html><html lang="en"><head><title>Example</title></head><body><DIV CLASS=sample>Example</DIV></body></html>';
    for (const configuration of ['html', 'site']) {
        const file = outputs.find(({ path }) => path.endsWith(`/${configuration}/html-validate.json`))!;
        const report = await new HtmlValidate(JSON.parse(file.content) as ConfigData).validateString(source);
        const rules = report.results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId));
        if (configuration === 'html') expect(rules).toStrictEqual([]);
        else for (const rule of ['attr-case', 'attr-quotes', 'element-case']) expect(rules).toContain(rule);
    }
});
