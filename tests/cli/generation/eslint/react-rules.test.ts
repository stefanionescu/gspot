// The React and React Native rules the generated ESLint configuration enables, each seen on a test file.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { Level } from '#cli/types/configurations.ts';
import { containing } from '#tests/harness/expectations.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { emitFile, createEslint } from '#tests/harness/generated.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import type { FileRuleFinding } from '#tests/types/generation/findings.ts';

import {
    WEB_TSCONFIG,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    EXPO_DEPENDENCIES,
    NATIVE_DEPENDENCIES,
} from '#tests/config/samples/react.ts';
import {
    WEB_FILES,
    NATIVE_FILES,
    WEB_EXPECTED,
    NATIVE_EXPECTED,
    NATIVE_CORRECTIONS,
} from '#tests/config/cli/generation/eslint/react-rules.ts';

// Creates the repository at the level and returns every message ESLint reports for its files.
async function reported(
    root: string,
    configuration: string,
    level: Level,
    files: Record<string, string>,
): Promise<FileRuleFinding[]> {
    const web = configuration === 'react';
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['typescript', configuration, ...(web ? ['react-dom'] : ['expo'])], {
            tables: '[agent_rules]\nenabled = false\n',
            level: level,
        }),
        'package.json': JSON.stringify({
            name: 'example',
            private: true,
            type: 'module',
            dependencies: web ? WEB_DEPENDENCIES : EXPO_DEPENDENCIES,
        }),
        'tsconfig.json': JSON.stringify(web ? WEB_TSCONFIG : NATIVE_TSCONFIG, null, 4) + '\n',
        ...files,
    });
    const eslint = await createEslint(root);
    const results = await eslint.lintFiles(Object.keys(files));
    return results.flatMap(({ filePath, messages }) =>
        messages.map(({ ruleId, line }) => ({
            rule: ruleId,
            file: filePath.slice(root.length + 1).replaceAll('\\', '/'),
            line,
        })),
    );
}

test.each([
    ['react', WEB_FILES, WEB_EXPECTED],
    ['react-native', NATIVE_FILES, NATIVE_EXPECTED],
] as const)('the generated %s configuration reports each test rule', async (configuration, files, expected) => {
    await using sandbox = await testdir();
    const messages = await reported(sandbox.path, configuration, 'all', files);
    for (const finding of expected) expect(messages).toContainEqual(finding);
});

test('react/self-closing-comp waits for the all level', async () => {
    await using sandbox = await testdir();
    const files = { 'src/Gap.tsx': WEB_FILES['src/Gap.tsx'] };
    const atRecommended = await reported(sandbox.path, 'react', 'recommended', files);
    expect(atRecommended.map(({ rule }) => rule)).not.toContain('react/self-closing-comp');
    const atAll = await reported(sandbox.path, 'react', 'all', files);
    expect(atAll).toContainEqual({ rule: 'react/self-closing-comp', file: 'src/Gap.tsx', line: 9 });
});

test('the emitted bare project requires native linting without Expo or DOM tools', async () => {
    const project = parseToolProject(
        await emitFile(buildPolicy(['typescript', 'react-native']), '.gspot/package.json', {
            'package.json': JSON.stringify({ name: 'example', private: true, dependencies: NATIVE_DEPENDENCIES }),
            'tsconfig.json': JSON.stringify(NATIVE_TSCONFIG),
        }),
    );
    expect(project.dependencies).toHaveProperty('eslint-plugin-react-native');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-expo');
    expect(project.dependencies).not.toHaveProperty('expo-doctor');
    expect(project.dependencies).not.toHaveProperty('eslint-plugin-jsx-a11y');
});

test.each([...NATIVE_CORRECTIONS])(
    '$name reports its native rule and accepts the original correction',
    async ({ configurations, dependencies, file, source, rule, line }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([...configurations], { level: 'all' });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': JSON.stringify({ name: 'example', private: true, type: 'module', dependencies }),
            'tsconfig.json': JSON.stringify(NATIVE_TSCONFIG),
            [file]: source,
        });
        const eslint = await createEslint(sandbox.path);
        const failed = await eslint.lintFiles([file]);
        expect(failed[0]!.filePath).toBe(join(sandbox.path, file));
        expect(failed[0]!.messages).toContainEqual(containing({ ruleId: rule, line }));
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
        await Bun.write(join(sandbox.path, file), COMPONENT_SOURCE);
        const corrected = await eslint.lintFiles([file]);
        expect(
            corrected.flatMap(({ messages }) => messages.filter(({ ruleId, fatal }) => ruleId === rule || fatal)),
        ).toStrictEqual([]);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(COMPONENT_SOURCE);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);
