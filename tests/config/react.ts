import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

const VERSION_PAIR_CASES = [
    {
        name: 'different ranges with equal installed versions pass',
        left: '^19.0.0',
        right: '~19.1.1',
        installedLeft: '19.1.1',
        installedRight: '19.1.1',
        findings: 0,
    },
    {
        name: 'equal ranges with different installed versions report the pair',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: '19.1.1',
        installedRight: '19.1.0',
        findings: 1,
    },
    {
        name: 'an uninstalled pair has no version to compare',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: undefined,
        installedRight: undefined,
        findings: 0,
    },
    {
        name: 'one uninstalled package has no paired version to compare',
        left: '^19.0.0',
        right: '^19.0.0',
        installedLeft: '19.1.1',
        installedRight: undefined,
        findings: 0,
    },
] as const;

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
const WEB_PACKAGES = ['react', 'react-dom'] as const;

/** A component accepted by the configured React rules. */
const CLEAN_COMPONENT =
    `// A test component.
import type { ReactNode } from 'react';

` +
    `/**
 * Greets one person.
 * @param props the person
 * @param props.name the name
 * @returns the greeting
 */
export function Greeting({ name }: Readonly<{ name: string }>): ReactNode {
    return <p>{name}</p>;
}
`;

const REACT_SANDBOX = {
    configurations: ['typescript', 'react-dom'],
    tsconfig: WEB_TSCONFIG,
    files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
} as const;

const COUNTER = `// A test component.
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Counts, some of the time.
 * @param props whether to count
 * @param props.isOn whether to count
 * @returns the count
 */
export function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {
    if (isOn) {
        const [count] = useState(0);
        return <p>{count}</p>;
    }
    return <p>off</p>;
}
`;

const REACT_CASES = [
    {
        check: 'javascript/eslint',
        files: { 'src/Counter.tsx': COUNTER },
        expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
        corrected: {
            files: {
                'src/Counter.tsx': `// A test component.
import type { ReactNode } from 'react';

/**
 * Greets one person.
 * @param props the person
 * @param props.name the name
 * @returns the greeting
 */
export function Counter({ name }: Readonly<{ name: string }>): ReactNode {
    return <p>{name}</p>;
}
`,
            },
        },
    },
] as const;

/** The packages of a test Expo repository. */
const EXPO_DEPENDENCIES = {
    expo: '54.0.0',
    'react-native': '0.81.4',
} as const;

/** The packages of a bare React Native repository. */
const REACT_NATIVE_DEPENDENCIES = { 'react-native': '0.81.4' } as const;

/** The compiler options of a test React Native repository. */
const REACT_NATIVE_TSCONFIG = {
    compilerOptions: { ...STRICT_COMPILER_OPTIONS, module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx' },
    include: ['src'],
} as const;

export {
    REACT_CASES,
    WEB_PACKAGES,
    REACT_SANDBOX,
    EXPO_DEPENDENCIES,
    VERSION_PAIR_CASES,
    REACT_NATIVE_TSCONFIG,
    REACT_NATIVE_DEPENDENCIES,
};
