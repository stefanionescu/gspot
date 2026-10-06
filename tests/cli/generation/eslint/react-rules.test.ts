// The React and React Native rules the generated ESLint configuration enables, each seen on a test file.
import { test, expect } from 'bun:test';
import type { Level } from '#cli/types/rules.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { FileRuleFinding } from '#tests/types/generation/findings.ts';

import {
    WEB_FILES,
    NATIVE_FILES,
    WEB_EXPECTED,
    NATIVE_EXPECTED,
} from '#tests/config/cli/generation/eslint/react-rules.ts';
import {
    WEB_TSCONFIG,
    CLEAN_COMPONENT,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    EXPO_DEPENDENCIES,
} from '#tests/config/samples/react.ts';

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
        'src/Greeting.tsx': CLEAN_COMPONENT,
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

test('react/self-closing-comp waits for the all level, and the Testing Library rules stay in test files', async () => {
    await using sandbox = await testdir();
    const files = { 'src/Gap.tsx': WEB_FILES['src/Gap.tsx'], 'src/debugging.jsx': WEB_FILES['src/debugging.jsx'] };
    const atRecommended = await reported(sandbox.path, 'react', 'recommended', files);
    expect(atRecommended.map(({ rule }) => rule)).not.toContain('react/self-closing-comp');
    const atAll = await reported(sandbox.path, 'react', 'all', files);
    expect(atAll).toContainEqual({ rule: 'react/self-closing-comp', file: 'src/Gap.tsx', line: 9 });
    expect(atAll.filter(({ rule }) => rule?.startsWith('testing-library/') === true)).toStrictEqual([]);
});
