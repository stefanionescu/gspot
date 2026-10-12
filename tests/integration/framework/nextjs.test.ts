import { z } from 'zod';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { installedModules } from '#tests/setup/modules.ts';
import { createReadCache } from '#cli/system/file-reads.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { prepareInstalledSandbox } from '#tests/setup/sandbox.ts';
import workspacePackage from '#root-package' with { type: 'json' };
import nextManifest from 'next/package.json' with { type: 'json' };
import testsPackage from '#tests/package.json' with { type: 'json' };
import reactManifest from 'react/package.json' with { type: 'json' };
import reactDomManifest from 'react-dom/package.json' with { type: 'json' };
import type { Sandbox, InstalledSandboxPlan } from '#tests/types/sandbox.ts';

import {
    NEXT_PAGE,
    NEXT_LAYOUT,
    NEXT_PACKAGE,
    NEXTJS_SANDBOX,
    NEXT_BUILD_FAILURE_PAGE,
    REFERENCE_PROJECT_FILES,
} from '#tests/config/nextjs.ts';

// Runs the named checks alone, expects the exit code, and returns the report.
async function checked(repository: Sandbox, checks: string[], code: number): Promise<RunReport> {
    const outcome = await spawnGspot(repository.root, ['check', '--only', ...checks, '--json'], repository.environment);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(code);
    return JSON.parse(outcome.stdout) as RunReport;
}

const resources = new AsyncDisposableStack();

let installedSandbox: Sandbox;

beforeAll(async () => {
    const dependencies = Object.fromEntries(
        Object.entries({
            next: nextManifest.version,
            ...NEXT_PACKAGE.dependencies,
            react: reactManifest.version,
            'react-dom': reactDomManifest.version,
            typescript: workspacePackage.devDependencies.typescript,
            '@types/react': testsPackage.devDependencies['@types/react'],
            '@types/node': workspacePackage.devDependencies['@types/node'],
        }).toSorted(([left], [right]) => left.localeCompare(right)),
    );
    const scenario: InstalledSandboxPlan = {
        ...NEXTJS_SANDBOX,
        dependencies,
        files: {
            ...NEXTJS_SANDBOX.files,
            'package.json':
                JSON.stringify(
                    {
                        ...NEXT_PACKAGE,
                        dependencies,
                    },
                    null,
                    4,
                ) + '\n',
        },
    };
    // Webpack needs the sandbox and linked dependencies on one drive.
    const sandbox = resources.use(
        await testdir({}, { dirname: join(installedModules, '..', '.sandboxes', `gspot-test-${randomUUID()}`) }),
    );
    const environment = await prepareInstalledSandbox(sandbox.path, scenario);
    installedSandbox = {
        root: sandbox.path,
        environment,
        run: spawnGspot,
        [Symbol.asyncDispose]: sandbox[Symbol.asyncDispose].bind(sandbox),
    };
});

afterAll(async () => {
    await resources.disposeAsync();
});

test('type checking delegates to the Next.js check only when it runs', async () => {
    const direct = await checked(installedSandbox, ['typescript/tsc'], 0);
    expect(direct.checks).toMatchObject([{ check: 'typescript/tsc', status: 'passed' }]);
    const delegated = await checked(installedSandbox, ['typescript/tsc', 'nextjs/tsc'], 0);
    expect(delegated.checks.find(({ check }) => check === 'nextjs/tsc')?.status).toBe('passed');
    expect(delegated.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
        status: 'skipped',
        note: 'nextjs/tsc runs it here',
    });
});
test('nextjs/build builds the app at level all and is not run at level recommended', async () => {
    const { root, environment } = installedSandbox;
    const page = join(root, 'app/page.tsx');
    const settings = await Bun.file(join(root, 'gspot.toml')).text();
    const compiler = await Bun.file(join(root, 'tsconfig.json')).text();
    await Bun.write(page, NEXT_BUILD_FAILURE_PAGE);
    try {
        const failed = await checked(installedSandbox, ['nextjs/build'], 1);
        expect(failed.checks).toMatchObject([
            { check: 'nextjs/build', status: 'failed', findings: [{ rule: 'build' }] },
        ]);
        expect(failed.checks[0]!.findings[0]!.message).toContain('Build failed because of webpack errors');
        const recommended = await spawnGspot(root, ['set', 'level', 'recommended'], environment);
        expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
        const omitted = await checked(installedSandbox, ['nextjs/build'], 0);
        expect(omitted.checks).toStrictEqual([]);
        await Bun.write(page, NEXT_PAGE);
        const all = await spawnGspot(root, ['set', 'level', 'all'], environment);
        expect(all.code, all.stdout + all.stderr).toBe(0);
        await installToolProjects(root);
        const passed = await checked(installedSandbox, ['nextjs/build'], 0);
        expect(passed.checks).toMatchObject([{ check: 'nextjs/build', status: 'passed', findings: [] }]);
        expect(await Bun.file(join(root, 'tsconfig.json')).text()).toBe(compiler);
        expect(await Bun.file(join(root, 'gspot.toml')).text()).toBe(settings);
    } finally {
        await Bun.write(page, NEXT_PAGE);
        await Bun.write(join(root, 'gspot.toml'), settings);
        await installToolProjects(root);
    }
});
test('the i18n rules reject literal markup', async () => {
    const layout = join(installedSandbox.root, 'app/layout.tsx');
    // The translation rule reports text written in the markup.
    await Bun.write(layout, NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>'));
    try {
        const literal = await checked(installedSandbox, ['javascript/eslint'], 1);
        expect(literal.checks[0]!.findings).toContainEqual(
            containing({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
        );
    } finally {
        await Bun.write(layout, NEXT_LAYOUT);
    }
    const corrected = await checked(installedSandbox, ['javascript/eslint'], 0);
    expect(corrected.checks[0]!.findings).toStrictEqual([]);
});

test('nextjs/tsc generates types and checks a referenced project without writing build output', async () => {
    const { root } = installedSandbox;
    const compiler = await Bun.file(join(root, 'tsconfig.json')).text();
    const parsed = readTsconfig(root, join(root, 'tsconfig.json'), createReadCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...z.array(z.string()).parse(parsed['exclude'] ?? []), 'compiler-ref/**'],
    });
    await createFileTree(root, REFERENCE_PROJECT_FILES);
    await Bun.write(join(root, 'tsconfig.json'), authored);
    try {
        const failed = await checked(installedSandbox, ['nextjs/tsc'], 1);
        expect(failed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'failed' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            containing({
                file: 'compiler-ref/source.ts',
                rule: 'TS2322',
                line: 1,
                column: 14,
            }),
        );
        await Bun.write(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
        const passed = await checked(installedSandbox, ['nextjs/tsc'], 0);
        expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
        expect(await Bun.file(join(root, 'tsconfig.json')).text()).toBe(authored);
        expect(await Bun.file(join(root, 'compiler-ref/tsconfig.json')).text()).toBe(
            REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
        );
        expect(await Bun.file(join(root, 'compiler-ref/dist/source.js')).exists()).toBe(false);
        expect(await Bun.file(join(root, 'compiler-ref/tsconfig.tsbuildinfo')).exists()).toBe(false);
    } finally {
        await Bun.write(join(root, 'tsconfig.json'), compiler);
        await rm(join(root, 'compiler-ref'), { recursive: true });
    }
});
