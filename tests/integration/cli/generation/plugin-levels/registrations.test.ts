import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

test.each(['recommended', 'all'])(
    'global %s plugin registrations retain managed rules and local exports',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[[tools.eslint.adopted]]\nplugins.gspot = { module = "./plugin.mjs", export = "default" }\nrules."gspot/project" = "error"\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': '',
            'plugin.mjs': [
                'import plugin from "@gspot/eslint-plugin";',
                'export default { ...plugin, rules: { ...plugin.rules,',
                'project: { meta: { schema: [] }, create(context) {',
                'return { Program(node) { context.report({ node, message: "Project plugin loaded." }); } };',
                '} } } };',
            ].join('\n'),
        });
        const eslint = await generatedEslint(sandbox.path);
        const results = await eslint.lintText('"use client";\nexport const endpoint = process.env.SECRET;', {
            filePath: 'source.js',
        });
        expect(
            results
                .flatMap((file) => file.messages)
                .filter(({ ruleId }) => ruleId === 'gspot/project' || ruleId === 'gspot/no-client-environment'),
        ).toMatchObject([
            { ruleId: 'gspot/project', line: 1, message: 'Project plugin loaded.' },
            { ruleId: 'gspot/no-client-environment', line: 2, messageId: 'private' },
        ]);
    },
);

test.each(['scoped', 'version'])('plugin registration preserves the %s conflict', async (conflict) => {
    await using sandbox = await testdir();
    const selector = conflict === 'scoped' ? 'files = ["source.js"]\n' : '';
    const metadata = conflict === 'version' ? ', meta: { ...plugin.meta, version: "0.0.0" }' : '';
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = ["javascript"]\n[[tools.eslint.adopted]]\n${selector}plugins.gspot = { module = "./plugin.mjs", export = "default" }\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': '',
        'plugin.mjs': `import plugin from "@gspot/eslint-plugin"; export default { ...plugin${metadata} };`,
    });
    const eslint = await generatedEslint(sandbox.path);
    expect(await rejection(eslint.lintText('export const value = 1;', { filePath: 'source.js' }))).toContain(
        'Cannot redefine plugin "gspot"',
    );
});
