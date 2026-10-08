import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import { COUNTER, WEB_TSCONFIG, CLEAN_COMPONENT, WEB_DEPENDENCIES } from '#tests/config/samples/react.ts';

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
