import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

export const WEB_TSCONFIG = {
    compilerOptions: {
        ...STRICT_COMPILER_OPTIONS,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        lib: ['DOM', 'ES2022'],
    },
    include: ['src'],
} as const;

export const CLEAN_COMPONENT = `// A test component.
import type { ReactNode } from 'react';

/**
Greets one person.

@param props display text for the visitor
@param props.name text shown inside the paragraph
@returns a paragraph addressed to the visitor
*/
export function Greeting({ name }: Readonly<{ name: string }>): ReactNode {
    return <p>{name}</p>;
}
`;

const COUNTER = `// A test component.
import { useState, type ReactNode } from "react";

/**
Counts, some of the time.

@param props display controls for this component
@param props.isOn whether the counter is visible
@returns the current total in a paragraph
*/
export function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {
    if (isOn) {
        const [count] = useState(0);
        return <p>{count}</p>;
    }
    return <p>off</p>;
}
`;

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
