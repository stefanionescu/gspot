import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

/** The compiler options of a test React web repository. */
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

/** The packages of a test React web repository. */
export const WEB_PACKAGES = ['react', 'react-dom'] as const;

/** A component that the configured React rules accept. */
const CLEAN_COMPONENT =
    `// A test component.
import type { ReactNode } from 'react';

` +
    `/**
 * Greets one person.
 *
 * @param props display text for the visitor
 * @param props.name text shown inside the paragraph
 * @returns a paragraph addressed to the visitor
 */
export function Greeting({ name }: Readonly<{ name: string }>): ReactNode {
    return <p>{name}</p>;
}
`;

export const REACT_SANDBOX = {
    configurations: ['typescript', 'react-dom'],
    tsconfig: WEB_TSCONFIG,
    files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
} as const;

const COUNTER = `// A test component.
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Counts, some of the time.
 *
 * @param props display controls for this component
 * @param props.isOn whether the counter is visible
 * @returns the current total in a paragraph
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
        expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 14 },
        corrected: {
            files: {
                'src/Counter.tsx': CLEAN_COMPONENT.replace('function Greeting', 'function Counter'),
            },
        },
    },
] as const;

/** The packages of a test Expo repository. */
export const EXPO_DEPENDENCIES = {
    expo: '54.0.0',
    'react-native': '0.81.4',
} as const;

/** The packages of a bare React Native repository. */
export const REACT_NATIVE_DEPENDENCIES = { 'react-native': '0.81.4' } as const;
