// Planted repositories for the react and react-native configurations: each ESLint addition fires on a small component.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';
import { LIBRARIES_CLEAN } from '#tests/inputs/acceptance/source/kits/kits.ts';

import {
    TESTED,
    WEB_TSCONFIG,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    NATIVE_DEPENDENCIES,
} from '#tests/inputs/acceptance/source/kits/react.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every planted component opens with the same header comment and import.
const head = (text: string): string => `// A planted component.\nimport type { ReactNode } from 'react';\n\n${text}`;
const CLEAN = head(
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\n// eslint-disable-next-line gspot/no-trivial-functions -- reason: React calls this component through its rendering API.\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n',
).replace(
    'import type { ReactNode }',
    '// eslint-disable-next-line gspot/no-trivial-files -- reason: React requires this component module.\nimport type { ReactNode }',
);
const DEBUGGED = TESTED.replace("screen.getByText('hello');", () => 'screen.debug();');
const GAP = head(
    '/**\n * Leaves a gap.\n * @returns the gap\n */\nexport function Gap(): ReactNode {\n    return <div></div>;\n}\n',
);

// One planted component that a lint rule rejects, corrected by the clean component under the file's name.
function lintCase(rule: string, path: string, text: string, line: number, check = 'typescript/eslint'): FindingCase {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const name = base.slice(0, base.indexOf('.'));
    const corrected = check === 'typescript/eslint' ? CLEAN.replaceAll('Greeting', name) : TESTED;
    return {
        check,
        files: { [path]: text },
        expected: { file: path, rule, line },
        corrected: { files: { [path]: corrected } },
    };
}

const WEB: FindingCase[] = [
    lintCase(
        'react-hooks/rules-of-hooks',
        'src/Counter.tsx',
        '// A planted component.\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n * @param props whether to count\n * @param props.isOn whether to count\n * @returns the count\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n',
        13,
    ),
    lintCase(
        'react/jsx-key',
        'src/Names.tsx',
        head(
            '/**\n * Lists names.\n * @param props the names\n * @param props.names the names\n * @returns the list\n */\nexport function Names({ names }: Readonly<{ names: string[] }>): ReactNode {\n    return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n}\n',
        ),
        11,
    ),
    lintCase(
        'react/no-danger',
        'src/Raw.tsx',
        head(
            '/**\n * Shows markup it was handed.\n * @param props the markup\n * @param props.html the markup\n * @returns the element\n */\nexport function Raw({ html }: Readonly<{ html: string }>): ReactNode {\n    return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
        ),
        11,
    ),
    lintCase(
        'jsx-a11y/alt-text',
        'src/Picture.tsx',
        head(
            '/**\n * Shows a picture.\n * @returns the picture\n */\nexport function Picture(): ReactNode {\n    return <img src="picture.png" />;\n}\n',
        ),
        9,
    ),
    lintCase(
        'react-refresh/only-export-components',
        'src/Badge.tsx',
        head(
            '/** The size of a badge. */\nexport const badgeSize = 2;\n\n/**\n * Shows a badge.\n * @returns the badge\n */\nexport function Badge(): ReactNode {\n    return <span>{badgeSize}</span>;\n}\n',
        ),
        5,
    ),
    lintCase('testing-library/no-debugging-utils', 'src/greeting.test.jsx', DEBUGGED, 5, 'javascript/eslint'),
];

const NATIVE: FindingCase[] = [
    lintCase(
        'expo/no-env-var-destructuring',
        'src/address.ts',
        `// A planted file.\n\nconst { EXPO_PUBLIC_URL } = process.env;\n\n/** Where the service lives. */\nexport const address = EXPO_PUBLIC_URL;\n`,
        3,
    ),
    lintCase(
        'react-native/no-inline-styles',
        'src/Box.tsx',
        `// A planted file.\n\n/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n`,
        8,
    ),
    lintCase(
        'no-restricted-syntax',
        'src/Rows.tsx',
        `// A planted file.\n\n/**\n * Lists rows.\n * @returns the list\n */\nexport function Rows(): unknown {\n    return <FlatList data={[]} renderItem={undefined} />;\n}\n`,
        8,
    ),
    lintCase(
        'no-restricted-syntax',
        'src/session.ts',
        `// A planted file.\n\n/**\n * Keeps the session.\n * @param value the session\n * @returns when it is kept\n */\nexport async function keep(value: string): Promise<void> {\n    await AsyncStorage.setItem('auth_token', value);\n}\n`,
        9,
    ),
    lintCase(
        '@react-native/no-deep-imports',
        'src/frame.ts',
        `// A planted file.\n\nimport View from 'react-native/Libraries/Components/View/View';\n\n/** The view each screen draws in. */\nexport const Frame = View;\n`,
        3,
    ),
    lintCase(
        'react-native/no-raw-text',
        'src/Label.tsx',
        `// A planted file.\n\n/**\n * Labels a row.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n`,
        8,
    ),
].map((entry) => ({
    ...entry,
    corrected: { files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, LIBRARIES_CLEAN])) },
}));

// The required rules stay on after the cases ran.
function requiredRulesStay(planted: () => { root: string; environment: Record<string, string> }): void {
    test(
        'integrity/required-rules accepts the generated configuration',
        async () => {
            const { root, environment } = planted();
            const required = await run(root, ['check', '--only', 'integrity/required-rules'], environment);
            expect(required.code, required.stdout + required.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
}

plantedCases(
    'the react configuration',
    {
        kits: ['typescript', 'react'],
        dependencies: WEB_DEPENDENCIES,
        files: { 'tsconfig.json': WEB_TSCONFIG, 'src/Greeting.tsx': CLEAN },
    },
    WEB,
    requiredRulesStay,
);

plantedCases(
    'the react-native configuration',
    {
        kits: ['typescript', 'react-native'],
        dependencies: NATIVE_DEPENDENCIES,
        files: { 'tsconfig.json': NATIVE_TSCONFIG, 'src/answer.ts': LIBRARIES_CLEAN },
    },
    NATIVE,
    requiredRulesStay,
);

test(
    'react/self-closing-comp waits for the all level, and the Testing Library rules stay in test files',
    async () => {
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            kits: ['typescript', 'react'],
            dependencies: WEB_DEPENDENCIES,
            files: { 'tsconfig.json': WEB_TSCONFIG, 'src/Greeting.tsx': CLEAN },
            level: 'recommended',
        });
        const atRecommended = await runPlanted(
            sandbox.path,
            { check: 'typescript/eslint', files: { 'src/Gap.tsx': GAP } },
            environment,
        );
        const recommended = JSON.parse(atRecommended.stdout) as RunReport;
        expect(recommended.checks.flatMap(({ findings }) => findings).map(({ rule }) => rule)).not.toContain(
            'react/self-closing-comp',
        );
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const atAll = await runPlanted(
            sandbox.path,
            { check: 'typescript/eslint', files: { 'src/Gap.tsx': GAP } },
            environment,
        );
        const all = JSON.parse(atAll.stdout) as RunReport;
        expect(all.checks.flatMap(({ findings }) => findings)).toContainEqual(
            containing({ rule: 'react/self-closing-comp', file: 'src/Gap.tsx', line: 9 }),
        );
        const unrelated = await runPlanted(
            sandbox.path,
            { check: 'javascript/eslint', files: { 'src/debugging.jsx': DEBUGGED } },
            environment,
        );
        const outside = JSON.parse(unrelated.stdout) as RunReport;
        expect(
            outside.checks
                .flatMap(({ findings }) => findings)
                .filter(({ rule }) => rule?.startsWith('testing-library/') === true),
        ).toStrictEqual([]);
    },
    PLANTED_TIMEOUT_MS * 6,
);
