import { z } from 'zod';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import workspacePackage from '#root-package' with { type: 'json' };
import nextManifest from 'next/package.json' with { type: 'json' };
import testsPackage from '#tests/package.json' with { type: 'json' };
import reactManifest from 'react/package.json' with { type: 'json' };
import reactDomManifest from 'react-dom/package.json' with { type: 'json' };
import type { Sandbox, InstalledSandboxPlan } from '#tests/types/sandbox.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { NEXT_LAYOUT, NEXT_PACKAGE, NEXTJS_SANDBOX, REFERENCE_PROJECT_FILES } from '#tests/data/checks/nextjs.ts';

// Runs the named checks alone, expects the exit code, and returns the report.
async function checked(repository: Sandbox, checks: string[], code: number): Promise<RunReport> {
    const result = await spawnGspot(repository.root, ['check', '--only', ...checks, '--json'], repository.environment);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return JSON.parse(result.stdout) as RunReport;
}

const installedSandbox = registerSharedSandbox(buildNextjsPlan());

function buildNextjsPlan(): InstalledSandboxPlan {
    const dependencies = Object.fromEntries(
        Object.entries({
            next: nextManifest.version,
            ...NEXT_PACKAGE.dependencies,
            react: reactManifest.version,
            'react-dom': reactDomManifest.version,
            typescript: testsPackage.devDependencies.typescript,
            '@types/react': testsPackage.devDependencies['@types/react'],
            '@types/node': workspacePackage.devDependencies['@types/node'],
        }).toSorted(([left], [right]) => left.localeCompare(right)),
    );
    return {
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
}

test('type checking delegates to the Next.js check only when it runs', async () => {
    const direct = await checked(installedSandbox(), ['typescript/tsc'], 0);
    expect(direct.checks).toMatchObject([{ check: 'typescript/tsc', status: 'passed' }]);
    const delegated = await checked(installedSandbox(), ['typescript/tsc', 'nextjs/tsc'], 0);
    expect(delegated.checks.find(({ check }) => check === 'nextjs/tsc')?.status).toBe('passed');
    expect(delegated.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
        status: 'skipped',
        note: 'nextjs/tsc runs it here',
    });
});
test('the i18n rules reject literal markup', async () => {
    {
        // The translation rule reports text written in the markup.
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check: 'javascript/eslint',
            files: {
                'app/layout.tsx': NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>'),
            },
        });
        const literal = await checked(installedSandbox(), ['javascript/eslint'], 1);
        expect(literal.checks[0]!.findings).toContainEqual(
            matchFields({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
        );
    }
    const corrected = await checked(installedSandbox(), ['javascript/eslint'], 0);
    expect(corrected.checks[0]!.findings).toStrictEqual([]);
});

test('nextjs/tsc generates types and checks a referenced project without writing build output', async () => {
    const { root } = installedSandbox();
    const parsed = readTsconfig(root, join(root, 'tsconfig.json'), createReadCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...z.array(z.string()).parse(parsed['exclude'] ?? []), 'compiler-ref/**'],
    });
    await using _sourceChange = await updateSandbox(installedSandbox(), {
        check: 'nextjs/tsc',
        files: { ...REFERENCE_PROJECT_FILES, 'tsconfig.json': authored },
    });
    const failed = await checked(installedSandbox(), ['nextjs/tsc'], 1);
    expect(failed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'failed' }]);
    expect(failed.checks[0]!.findings).toContainEqual(
        matchFields({
            file: 'compiler-ref/source.ts',
            rule: 'TS2322',
            line: 1,
            column: 14,
        }),
    );
    await Bun.write(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
    const passed = await checked(installedSandbox(), ['nextjs/tsc'], 0);
    expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
    expect(await Bun.file(join(root, 'tsconfig.json')).text()).toBe(authored);
    expect(await Bun.file(join(root, 'compiler-ref/tsconfig.json')).text()).toBe(
        REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
    );
    expect(await Bun.file(join(root, 'compiler-ref/dist/source.js')).exists()).toBe(false);
    expect(await Bun.file(join(root, 'compiler-ref/tsconfig.tsbuildinfo')).exists()).toBe(false);
});
