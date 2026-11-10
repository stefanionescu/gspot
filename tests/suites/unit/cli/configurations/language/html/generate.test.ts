import { expect, test } from 'bun:test';
import { type ConfigData, HtmlValidate } from 'html-validate';
import { parse } from 'jsonc-parser';

import { openSession } from '#cli/engine/session.ts';
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

test('source HTML needs integrity on a script or stylesheet from another origin, and not on its own files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html']),
        'index.html': '<!doctype html><title>Root</title>',
    });
    const file = buildGeneratedFiles(await openSession(sandbox.path)).files.find(({ path }) =>
        path.endsWith('/html/html-validate.json'),
    )!;
    const validator = new HtmlValidate(JSON.parse(file.content) as ConfigData);
    const listRules = async (source: string): Promise<string[]> => {
        const report = await validator.validateString(source);
        return report.results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId));
    };
    expect(
        await listRules(
            '<!doctype html><html lang="en"><head><title>Example</title><script src="https://cdn.example.com/library.js"></script><script src="/app.js"></script></head><body></body></html>',
        ),
    ).toStrictEqual(['require-sri']);
    expect(
        await listRules(
            '<!doctype html><html lang="en"><head><title>Example</title><script src="https://cdn.example.com/library.js" integrity="sha384-example" crossorigin="anonymous"></script><script src="/app.js"></script></head><body></body></html>',
        ),
    ).toStrictEqual([]);
});

test.each([
    ['a Starlight site', '{"private":true,"dependencies":{"@astrojs/starlight":"0.0.0-test"}}', []],
    ['another site', '{"private":true}', ['no-implicit-button-type', 'unique-landmark']],
])('the built pages of %s report the markup that its packages write: %j', async (_name, packageJson, expected) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['html', 'site']),
        'package.json': packageJson,
        'index.html': '<!doctype html><title>Root</title>',
    });
    const outputs = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const file = outputs.find(({ path }) => path.endsWith('/site/html-validate.json'))!;
    const page =
        '<!doctype html><html lang="en"><head><title>Example</title></head><body><nav><a href="/">Home</a></nav><nav><a href="/docs/">Docs</a></nav><button>Copy</button></body></html>';
    const report = await new HtmlValidate(JSON.parse(file.content) as ConfigData).validateString(page);
    const rules = new Set(report.results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId)));
    expect(['no-implicit-button-type', 'unique-landmark'].filter((rule) => rules.has(rule))).toStrictEqual(expected);
});
