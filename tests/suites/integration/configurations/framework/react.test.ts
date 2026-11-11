import { test } from 'bun:test';

import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

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

const CLEAN_COMPONENT = `// A test component.
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
import { type ReactNode, useState } from "react";

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

const REACT_SAMPLE = {
    check: 'javascript/eslint',
    files: { 'src/Counter.tsx': COUNTER },
    expected: { file: 'src/Counter.tsx', rule: 'react-hooks/rules-of-hooks', line: 13 },
    corrected: {
        files: {
            'src/Counter.tsx': CLEAN_COMPONENT.replace('function Greeting', 'function Counter'),
        },
    },
} as const;

const installedSandbox = shareInstalledSandbox({
    ...({
        configurations: ['typescript', 'react-dom'],
        json: { 'tsconfig.json': WEB_TSCONFIG },
        files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
    } as const),
    dependencies: {
        '@types/react': SANDBOX_PACKAGES['@types/react'],
        react: SANDBOX_PACKAGES.react,
        'react-dom': SANDBOX_PACKAGES['react-dom'],
    },
});

test('javascript/eslint reports react-hooks/rules-of-hooks and passes after the fix', async () => {
    await assertCheckSample(installedSandbox(), REACT_SAMPLE);
});
