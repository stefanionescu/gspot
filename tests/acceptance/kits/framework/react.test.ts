// Installed React and React Native repositories: the generated ESLint configuration reaches each kit's plugins.
import { LIBRARIES_CLEAN } from '#tests/samples/components.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

import {
    WEB_TSCONFIG,
    CLEAN_COMPONENT,
    NATIVE_TSCONFIG,
    WEB_DEPENDENCIES,
    NATIVE_DEPENDENCIES,
} from '#tests/samples/react.ts';

const COUNTER =
    '// A planted component.\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n * @param props whether to count\n * @param props.isOn whether to count\n * @returns the count\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n';

plantedCases(
    'the react kit',
    {
        kits: ['typescript', 'react'],
        dependencies: WEB_DEPENDENCIES,
        files: { 'tsconfig.json': WEB_TSCONFIG, 'src/Greeting.tsx': CLEAN_COMPONENT },
    },
    [
        {
            check: 'typescript/eslint',
            files: { 'src/Counter.tsx': COUNTER },
            expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
            corrected: { files: { 'src/Counter.tsx': CLEAN_COMPONENT.replaceAll('Greeting', 'Counter') } },
        },
    ],
);

plantedCases(
    'the react-native kit',
    {
        kits: ['typescript', 'react-native'],
        dependencies: NATIVE_DEPENDENCIES,
        files: { 'tsconfig.json': NATIVE_TSCONFIG, 'src/answer.ts': LIBRARIES_CLEAN },
    },
    [
        {
            check: 'typescript/eslint',
            files: {
                'src/Box.tsx': `// A planted file.\n\n/**\n * Draws a box.\n * @returns the box\n */\nexport function Box(): unknown {\n    return <View style={{ padding: 8 }} />;\n}\n`,
            },
            expected: { file: 'src/Box.tsx', rule: 'react-native/no-inline-styles', line: 8 },
            corrected: { files: { 'src/Box.tsx': LIBRARIES_CLEAN } },
        },
    ],
);
