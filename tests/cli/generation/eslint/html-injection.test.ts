// Native framework rules reject raw markup at both levels and accept escaped text.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { COMPONENTS } from '#tests/config/cli/generation/eslint/html-injection.ts';

test.each(
    COMPONENTS.flatMap((component) => (['recommended', 'all'] as const).map((level) => ({ ...component, level }))),
)('$configuration rejects raw HTML and accepts text at $level', async (component) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([component.configuration], {
            level: component.level,
        }),
        'package.json': '{"name":"markup-security","private":true,"type":"module"}',
        [component.path]: component.sample,
    });
    const eslint = await createEslint(sandbox.path);
    const findings = await eslint.lintText(component.sample, { filePath: component.path });
    expect(findings.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
    expect(
        findings.flatMap(({ messages }) =>
            messages.filter(({ ruleId }) => ruleId === component.rule).map(({ line }) => line),
        ),
    ).toStrictEqual([1]);
    const corrected = await eslint.lintText(component.corrected, { filePath: component.path });
    expect(
        corrected.flatMap(({ messages }) =>
            messages.filter(({ ruleId, fatal }) => fatal === true || ruleId === component.rule),
        ),
    ).toStrictEqual([]);
});
