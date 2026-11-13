import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { compareText } from '#cli/system/text/order.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import workspacePackage from '#root-package' with { type: 'json' };
import { NEXT_MESSAGES } from '#tests/config/setup/configurations.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { tsconfigSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import type { Sandbox } from '#tests/types/setup.ts';

const NEXT_PACKAGE = {
    name: 'example',
    version: '1.0.0',
    description: 'A test Next.js app for the tests.',
    private: true,
    type: 'module',
    scripts: {
        build: 'next build --webpack',
    },
    dependencies: {
        'next-intl': '4.3.9',
    },
} as const;

const NEXT_CONFIG_SOURCE = `// The framework configuration.
const config = { reactStrictMode: true };

export default config;
`;

const NEXT_PAGE = `// The home page.

/**
Renders the home page.
@returns text for the application entry route
*/
export default function Page(): string {
    return "home";
}
`;

const NEXT_LAYOUT = `// The root layout.
import type { ReactNode } from 'react';

/**
Wraps every page.
@param props content to place inside the document body
@param props.children route content to render inside the body
@returns the HTML wrapper shared by every route
*/
export default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
`;

const NEXTJS_SANDBOX = {
    configurations: ['nextjs', 'translations'],
    json: {
        'tsconfig.json': {
            compilerOptions: {
                ...STRICT_COMPILER_OPTIONS,
                module: 'ESNext',
                moduleResolution: 'Bundler',
                jsx: 'react-jsx',
                lib: ['DOM', 'DOM.Iterable', 'ES2022'],
                noEmit: true,
                plugins: [{ name: 'next' }],
            },
            include: ['app'],
        },
    },
    without: ['css'],
    files: {
        '.gitignore': `node_modules
.next
`,
        'next.config.mjs': NEXT_CONFIG_SOURCE,
        'app/page.tsx': NEXT_PAGE,
        'app/layout.tsx': NEXT_LAYOUT,
        ...NEXT_MESSAGES,
    },
} as const;

const REFERENCE_PROJECT_FILES = {
    'compiler-ref/tsconfig.json':
        '{"compilerOptions":{"composite":true,"strict":true,"types":[],"outDir":"./dist"},"files":["source.ts"]}\n',
    'compiler-ref/source.ts': 'export const value: number = "wrong";\n',
} as const;

const REFERENCED_PROJECT_FINDING = {
    file: 'compiler-ref/source.ts',
    rule: 'TS2322',
    line: 1,
    column: 14,
} as const;

async function readCheckReport(sandbox: Sandbox, checks: string[], code: number): Promise<RunReport> {
    const result = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', checks.join(','), '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

const npmPins = listPackagePins(readConfigurations().values().toArray()).npm;

const dependencies = Object.fromEntries(
    Object.entries({
        next: SANDBOX_PACKAGES.next,
        ...NEXT_PACKAGE.dependencies,
        react: SANDBOX_PACKAGES.react,
        'react-dom': SANDBOX_PACKAGES['react-dom'],
        typescript: npmPins['typescript']!,
        '@types/react': SANDBOX_PACKAGES['@types/react'],
        '@types/node': workspacePackage.devDependencies['@types/node'],
    }).toSorted(([left], [right]) => compareText(left, right)),
);

const installedSandbox = shareInstalledSandbox({
    ...NEXTJS_SANDBOX,
    dependencies,
    files: {
        ...NEXTJS_SANDBOX.files,
        'package.json': `${JSON.stringify({ ...NEXT_PACKAGE, dependencies }, null, JSON_INDENT)}\n`,
    },
});

test('nextjs/tsc generates types and checks a referenced project without writing build output', async () => {
    const { root } = installedSandbox();
    const parsed = readTsconfig(root, join(root, 'tsconfig.json'), createRunCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...(tsconfigSchema.parse(parsed).exclude ?? []), 'compiler-ref/**'],
    });
    await using _sourceChange = await changeSandbox(installedSandbox(), {
        files: { ...REFERENCE_PROJECT_FILES, 'tsconfig.json': authored },
    });
    const failed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 1);
    expect(failed.checks).toMatchObject([
        { check: 'nextjs/tsc', status: 'failed', findings: [REFERENCED_PROJECT_FINDING] },
    ]);
    await writeFile(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
    const passed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 0);
    expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(authored);
    expect(await readFile(join(root, 'compiler-ref/tsconfig.json'), 'utf8')).toBe(
        REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
    );
    expect(existsSync(join(root, 'compiler-ref/dist/source.js'))).toBe(false);
    expect(existsSync(join(root, 'compiler-ref/tsconfig.tsbuildinfo'))).toBe(false);
});
