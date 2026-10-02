// The React and React Native rules the generated ESLint configuration enables, each seen on a planted file.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

import {
    WEB_TSCONFIG,
    RENDERED_TEST,
    CLEAN_COMPONENT,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    plantedComponent,
    NATIVE_DEPENDENCIES,
} from '#tests/samples/react.ts';

const WEB_FILES = {
    'src/Names.tsx': plantedComponent(
        '/**\n * Lists names.\n * @param props the names\n * @param props.names the names\n * @returns the list\n */\nexport function Names({ names }: Readonly<{ names: string[] }>): ReactNode {\n    return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n}\n',
    ),
    'src/Raw.tsx': plantedComponent(
        '/**\n * Shows markup it was handed.\n * @param props the markup\n * @param props.html the markup\n * @returns the element\n */\nexport function Raw({ html }: Readonly<{ html: string }>): ReactNode {\n    return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
    ),
    'src/Picture.tsx': plantedComponent(
        '/**\n * Shows a picture.\n * @returns the picture\n */\nexport function Picture(): ReactNode {\n    return <img src="picture.png" />;\n}\n',
    ),
    'src/Badge.tsx': plantedComponent(
        '/** The size of a badge. */\nexport const badgeSize = 2;\n\n/**\n * Shows a badge.\n * @returns the badge\n */\nexport function Badge(): ReactNode {\n    return <span>{badgeSize}</span>;\n}\n',
    ),
    'src/Gap.tsx': plantedComponent(
        '/**\n * Leaves a gap.\n * @returns the gap\n */\nexport function Gap(): ReactNode {\n    return <div></div>;\n}\n',
    ),
    'src/greeting.test.jsx': RENDERED_TEST.replace("screen.getByText('hello');", () => 'screen.debug();'),
    'src/debugging.jsx': RENDERED_TEST.replace("screen.getByText('hello');", () => 'screen.debug();'),
};

const WEB_EXPECTED = [
    { rule: 'react/jsx-key', file: 'src/Names.tsx', line: 11 },
    { rule: 'react/no-danger', file: 'src/Raw.tsx', line: 11 },
    { rule: 'jsx-a11y/alt-text', file: 'src/Picture.tsx', line: 9 },
    { rule: 'react-refresh/only-export-components', file: 'src/Badge.tsx', line: 5 },
    { rule: 'testing-library/no-debugging-utils', file: 'src/greeting.test.jsx', line: 5 },
];

const NATIVE_FILES = {
    'src/address.ts': `// A planted file.\n\nconst { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n`,
    'src/Rows.tsx': `// A planted file.\n\n/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n`,
    'src/session.ts': `// A planted file.\n\n/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n`,
    'src/frame.ts': `// A planted file.\n\nimport View from 'react-native/Libraries/Components/View/View';\n\n/** The view each screen draws in. */\nexport const Frame = View;\n`,
    'src/Label.tsx': `// A planted file.\n\n/**\n * Labels a row.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n`,
};

const NATIVE_EXPECTED = [
    { rule: 'expo/no-env-var-destructuring', file: 'src/address.ts', line: 3 },
    { rule: 'no-restricted-syntax', file: 'src/Rows.tsx', line: 8 },
    { rule: 'no-restricted-syntax', file: 'src/session.ts', line: 9 },
    { rule: '@react-native/no-deep-imports', file: 'src/frame.ts', line: 3 },
    { rule: 'react-native/no-raw-text', file: 'src/Label.tsx', line: 8 },
];

// Plants the repository at the level and returns every message ESLint reports for its files.
async function reported(
    root: string,
    kit: string,
    level: string,
    files: Record<string, string>,
): Promise<{ rule: string | null; file: string; line: number }[]> {
    const web = kit === 'react';
    await createFileTree(root, {
        'gspot.toml': policyOf(['typescript', kit], '[rules]\ninstall = false\n', level),
        'package.json': JSON.stringify({
            name: 'planted',
            private: true,
            type: 'module',
            dependencies: web ? WEB_DEPENDENCIES : NATIVE_DEPENDENCIES,
        }),
        'tsconfig.json': web ? WEB_TSCONFIG : NATIVE_TSCONFIG,
        'src/Greeting.tsx': CLEAN_COMPONENT,
        ...files,
    });
    const eslint = await generatedEslint(root);
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
] as const)('the generated %s configuration reports each planted rule', async (kit, files, expected) => {
    await using sandbox = await testdir();
    const messages = await reported(sandbox.path, kit, 'all', files);
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
