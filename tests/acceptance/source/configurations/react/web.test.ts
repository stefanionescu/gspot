import { reportSchema } from '#cli/execution/report.ts';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { testdir } from 'testdirs';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
// Planted repository for the react configuration: a hook inside a condition, a list with no keys, markup set from a string, an image with no text, a file that exports more than components, an empty element left open, and a debugging call left in a test.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const REPORT = '.gspot/reports/report.json';
const DEPENDENCIES = { react: '19.1.1', 'react-dom': '19.1.1' };
const TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "ESNext",\n        "moduleResolution": "Bundler",\n        "types": [],\n        "skipLibCheck": true,\n        "jsx": "react-jsx",\n        "lib": ["DOM", "ES2022"]\n    },\n    "include": ["src"]\n}\n';
const head = (text: string): string => `// A planted component.\nimport type { ReactNode } from 'react';\n\n${text}`;
const CLEAN = head(
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\n// eslint-disable-next-line gspot/no-trivial-functions -- reason: React calls this component through its rendering API.\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n',
).replace(
    'import type { ReactNode }',
    '// eslint-disable-next-line gspot/no-trivial-files -- reason: React requires this component module.\nimport type { ReactNode }',
);
const TESTED =
    "// A planted test.\nimport { render, screen } from '@testing-library/react';\n\nrender(<p>hello</p>);\nscreen.getByText('hello');\n";
const DEBUGGED = TESTED.replace("screen.getByText('hello');", () => 'screen.debug();');
const GAP = head(
    '/**\n * Leaves a gap.\n * @returns the gap\n */\nexport function Gap(): ReactNode {\n    return <div></div>;\n}\n',
);

/** One planted defect: the check that reads it, where it is, and the file that corrects it. */
type LintCase = { check: string; rule: string; path: string; text: string; line: number; corrected: string };

const LINT: LintCase[] = [
    {
        check: 'typescript/eslint',
        rule: 'react-hooks/rules-of-hooks',
        path: 'src/Counter.tsx',
        text: '// A planted component.\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n * @param props whether to count\n * @param props.isOn whether to count\n * @returns the count\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n',
        line: 13,
        corrected: CLEAN.replaceAll('Greeting', 'Counter'),
    },
    {
        check: 'typescript/eslint',
        rule: 'react/jsx-key',
        path: 'src/Names.tsx',
        text: head(
            '/**\n * Lists names.\n * @param props the names\n * @param props.names the names\n * @returns the list\n */\nexport function Names({ names }: Readonly<{ names: string[] }>): ReactNode {\n    return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n}\n',
        ),
        line: 11,
        corrected: CLEAN.replaceAll('Greeting', 'Names'),
    },
    {
        check: 'typescript/eslint',
        rule: 'react/no-danger',
        path: 'src/Raw.tsx',
        text: head(
            '/**\n * Shows markup it was handed.\n * @param props the markup\n * @param props.html the markup\n * @returns the element\n */\nexport function Raw({ html }: Readonly<{ html: string }>): ReactNode {\n    return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
        ),
        line: 11,
        corrected: CLEAN.replaceAll('Greeting', 'Raw'),
    },
    {
        check: 'typescript/eslint',
        rule: 'jsx-a11y/alt-text',
        path: 'src/Picture.tsx',
        text: head(
            '/**\n * Shows a picture.\n * @returns the picture\n */\nexport function Picture(): ReactNode {\n    return <img src="picture.png" />;\n}\n',
        ),
        line: 9,
        corrected: CLEAN.replaceAll('Greeting', 'Picture'),
    },
    {
        check: 'typescript/eslint',
        rule: 'react-refresh/only-export-components',
        path: 'src/Badge.tsx',
        text: head(
            '/** The size of a badge. */\nexport const badgeSize = 2;\n\n/**\n * Shows a badge.\n * @returns the badge\n */\nexport function Badge(): ReactNode {\n    return <span>{badgeSize}</span>;\n}\n',
        ),
        line: 5,
        corrected: CLEAN.replaceAll('Greeting', 'Badge'),
    },
    {
        check: 'javascript/eslint',
        rule: 'testing-library/no-debugging-utils',
        path: 'src/greeting.test.jsx',
        text: DEBUGGED,
        line: 5,
        corrected: TESTED,
    },
];

const installReact = (root: string, level: 'recommended' | 'all'): Promise<Record<string, string>> =>
    installSandbox(root, {
        configurations: ['typescript', 'react'],
        dependencies: DEPENDENCIES,
        files: { 'tsconfig.json': TSCONFIG, 'src/Greeting.tsx': CLEAN },
        level,
    });

describe('the react configuration', () => {
    test.each(LINT)(
        '$rule in $path fails and corrected source passes',
        async ({ check, rule, path, text, line, corrected }) => {
            await using sandbox = await testdir();
            const environment = await installReact(sandbox.path, 'all');
            const clean = await run(sandbox.path, ['check', '--only', check, '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, { check, files: { [path]: text } }, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(failed.checks).toMatchObject([{ check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining({ rule, file: path, line }));
            await Bun.write(join(sandbox.path, path), corrected);
            const fixed = await run(sandbox.path, ['check', '--only', check, '--no-cache', '--json'], environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(fixed.stdout)).checks).toMatchObject([
                { check, status: 'ok', findings: [] },
            ]);
            const required = await run(
                sandbox.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache'],
                environment,
            );
            expect(required.code, required.stdout + required.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'react/self-closing-comp waits for the all level, and the Testing Library rules stay in test files',
        async () => {
            await using sandbox = await testdir();
            const environment = await installReact(sandbox.path, 'recommended');
            await runPlanted(sandbox.path, { check: 'typescript/eslint', files: { 'src/Gap.tsx': GAP } }, environment);
            const recommended = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(recommended.checks.flatMap(({ findings }) => findings).map(({ rule }) => rule)).not.toContain(
                'react/self-closing-comp',
            );
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await runPlanted(sandbox.path, { check: 'typescript/eslint', files: { 'src/Gap.tsx': GAP } }, environment);
            const all = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(all.checks.flatMap(({ findings }) => findings)).toContainEqual(
                expect.objectContaining({ rule: 'react/self-closing-comp', file: 'src/Gap.tsx', line: 9 }),
            );
            await runPlanted(
                sandbox.path,
                { check: 'javascript/eslint', files: { 'src/debugging.jsx': DEBUGGED } },
                environment,
            );
            const outside = reportSchema.parse(await Bun.file(join(sandbox.path, REPORT)).json());
            expect(
                outside.checks
                    .flatMap(({ findings }) => findings)
                    .filter(({ rule }) => rule?.startsWith('testing-library/') === true),
            ).toStrictEqual([]);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
