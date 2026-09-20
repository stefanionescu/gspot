import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
// Planted repository for the react preset: a hook inside a condition, a list with no keys, and markup set from a string.
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript',
    'react',
    '--without',
    'naming',
    'spelling',
    'css',
    'vitest',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "react": "19.1.1",\n        "react-dom": "19.1.1"\n    }\n}\n';
const TSCONFIG =
    '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "compilerOptions": { "jsx": "react-jsx", "module": "ESNext", "moduleResolution": "Bundler", "lib": ["DOM", "ES2022"] },\n    "include": ["src"]\n}\n';
const head = (text: string): string => `// A planted component.\nimport type { ReactNode } from 'react';\n\n${text}`;
const CLEAN = head(
    '/**\n * Greets one person.\n * @param props the person\n * @param props.name the name\n * @returns the greeting\n */\nexport function Greeting({ name }: Readonly<{ name: string }>): ReactNode {\n    return <p>{name}</p>;\n}\n',
);

const LINT: [string, string, string][] = [
    [
        'react-hooks/rules-of-hooks',
        'src/Counter.tsx',
        '// A planted component.\nimport { useState } from "react";\nimport type { ReactNode } from "react";\n\n/**\n * Counts, some of the time.\n * @param props whether to count\n * @param props.isOn whether to count\n * @returns the count\n */\nexport function Counter({ isOn }: Readonly<{ isOn: boolean }>): ReactNode {\n    if (isOn) {\n        const [count] = useState(0);\n        return <p>{count}</p>;\n    }\n    return <p>off</p>;\n}\n',
    ],
    [
        'react/jsx-key',
        'src/Names.tsx',
        head(
            '/**\n * Lists names.\n * @param props the names\n * @param props.names the names\n * @returns the list\n */\nexport function Names({ names }: Readonly<{ names: string[] }>): ReactNode {\n    return <ul>{names.map((name) => <li>{name}</li>)}</ul>;\n}\n',
        ),
    ],
    [
        'react/no-danger',
        'src/Raw.tsx',
        head(
            '/**\n * Shows markup it was handed.\n * @param props the markup\n * @param props.html the markup\n * @returns the element\n */\nexport function Raw({ html }: Readonly<{ html: string }>): ReactNode {\n    return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
        ),
    ],
];

describe('the react preset', () => {
    test(
        'the hooks rules and the React rules fire on their planted components, with no Next.js in the repository',
        async () => {
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': TSCONFIG,
                'src/Greeting.tsx': CLEAN,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(fixture.path, INIT, environment);
            const written = await Bun.file(join(fixture.path, '.gspot/eslint.config.mjs')).text();
            expect(written).toContain("from 'eslint-plugin-react-hooks'");
            expect(written).not.toContain('@next/eslint-plugin-next');
            const clean = await run(fixture.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const [rule, path, text] of LINT) {
                const outcome = await runPlanted(
                    fixture.path,
                    { check: 'typescript/eslint', files: { [path]: text }, expected: rule },
                    environment,
                );
                expect(outcome.stdout, `${rule}: ${outcome.stdout}${outcome.stderr}`).toContain(rule);
            }
            const required = await run(
                fixture.path,
                ['check', '--only', 'integrity/required-rules', '--no-cache'],
                environment,
            );
            expect(required.code, required.stdout + required.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
