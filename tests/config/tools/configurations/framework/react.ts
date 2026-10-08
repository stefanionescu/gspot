import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

import {
    WEB_TSCONFIG,
    CLEAN_COMPONENT,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    EXPO_DEPENDENCIES,
    NATIVE_DEPENDENCIES,
} from '#tests/config/samples/react.ts';

export const COUNTER =
    '// A test component.\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n * @param props whether to count\n * @param props.isOn whether to count\n * @returns the count\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n';

/** Text directly inside a native View instead of a Text component. */
export const RAW_NATIVE_TEXT =
    '// A test component.\n\n/**\n * Draws a label.\n * @returns the label\n */\nexport function Label(): unknown {\n    return <View>label</View>;\n}\n';

export const REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'react-dom'],
    tsconfig: WEB_TSCONFIG,
    dependencies: WEB_DEPENDENCIES,
    files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
};

export const CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: { 'src/Counter.tsx': COUNTER },
        expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
        corrected: {
            files: {
                'src/Counter.tsx':
                    "// A test component.\nimport type { ReactNode } from 'react';\n\n/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\nexport function Counter({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n",
            },
        },
    },
];

export const EXPO_REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'expo'],
    tsconfig: NATIVE_TSCONFIG,
    dependencies: EXPO_DEPENDENCIES,
    files: { 'src/answer.ts': COMPONENT_SOURCE },
};

export const EXPO_CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: {
            'src/Box.tsx': `// A test file.\n\n/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n`,
        },
        expected: { file: 'src/Box.tsx', rule: 'react-native/no-inline-styles', line: 8 },
        corrected: { files: { 'src/Box.tsx': COMPONENT_SOURCE } },
    },
];

export const NATIVE_REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'react-native'],
    tsconfig: NATIVE_TSCONFIG,
    dependencies: NATIVE_DEPENDENCIES,
    files: { 'src/answer.ts': COMPONENT_SOURCE },
};

export const NATIVE_CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: { 'src/Label.tsx': RAW_NATIVE_TEXT },
        expected: { file: 'src/Label.tsx', rule: 'react-native/no-raw-text', line: 8 },
        corrected: { files: { 'src/Label.tsx': COMPONENT_SOURCE } },
    },
];
