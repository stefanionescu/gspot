import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

export const WEB_PACKAGES = ['@types/react', 'react', 'react-dom'] as const;

const WEB_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        lib: ['DOM', 'ES2022'],
    },
    include: ['src'],
} as const;

const CLEAN_COMPONENT =
    `// A test component.
import type { ReactNode } from 'react';

` +
    '/**\n * Greets one person.\n *\n * @param props display text for the visitor\n * @param props.name text shown inside the paragraph\n * @returns a paragraph addressed to the visitor\n */\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n';

export const REACT_SANDBOX = {
    configurations: ['typescript', 'react-dom'],
    json: { 'tsconfig.json': WEB_TSCONFIG },
    files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
} as const;

const COUNTER =
    '// A test component.\nimport { useState, type ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n *\n * @param props display controls for this component\n * @param props.isOn whether the counter is visible\n * @returns the current total in a paragraph\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n';

export const REACT_CASES = [
    {
        check: 'javascript/eslint',
        files: { 'src/Counter.tsx': COUNTER },
        expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
        corrected: {
            files: {
                'src/Counter.tsx': CLEAN_COMPONENT.replace('function Greeting', 'function Counter'),
            },
        },
    },
] as const;
