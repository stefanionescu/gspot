import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { pathsSchema } from '#tests/schemas/checks/typescript.ts';
import nextPackage from 'next/package.json' with { type: 'json' };
import workspacePackage from '#root-package' with { type: 'json' };
import reactPackage from 'react/package.json' with { type: 'json' };
import testsPackage from '#tests/package.json' with { type: 'json' };
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import reactDomPackage from 'react-dom/package.json' with { type: 'json' };
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import type { Sandbox, InstalledSandboxPlan } from '#tests/types/sandbox.ts';

import {
    NEXT_PACKAGE,
    NEXTJS_SANDBOX,
    REFERENCE_PROJECT_FILES,
    REFERENCED_PROJECT_FINDING,
} from '#tests/data/checks/nextjs.ts';

/** Run the named checks alone, check the exit code, and return the report. */
async function readCheckReport(repository: Sandbox, checks: string[], code: number): Promise<RunReport> {
    const result = parseCheckReport(
        await spawnGspot(repository.root, ['check', '--only', checks.join(','), '--json'], repository.environment),
    );
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

const installedSandbox = shareInstalledSandbox(buildNextjsPlan());

function buildNextjsPlan(): InstalledSandboxPlan {
    const dependencies = Object.fromEntries(
        Object.entries({
            next: nextPackage.version,
            ...NEXT_PACKAGE.dependencies,
            react: reactPackage.version,
            'react-dom': reactDomPackage.version,
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

test('nextjs/tsc generates types and checks a referenced project without writing build output', async () => {
    const { root } = installedSandbox();
    const parsed = readTsconfig(root, join(root, 'tsconfig.json'), createReadCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...pathsSchema.parse(parsed['exclude'] ?? []), 'compiler-ref/**'],
    });
    await using _sourceChange = await changeAppliedSandbox(installedSandbox(), {
        check: 'nextjs/tsc',
        files: { ...REFERENCE_PROJECT_FILES, 'tsconfig.json': authored },
    });
    const failed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 1);
    expect(failed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'failed' }]);
    expect(failed.checks[0]!.findings).toContainEqual(matchFields(REFERENCED_PROJECT_FINDING));
    await writeFile(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
    const passed = await readCheckReport(installedSandbox(), ['nextjs/tsc'], 0);
    expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(authored);
    expect(await readFile(join(root, 'compiler-ref/tsconfig.json'), 'utf8')).toBe(
        REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
    );
    expect(await isOnDisk(join(root, 'compiler-ref/dist/source.js'))).toBe(false);
    expect(await isOnDisk(join(root, 'compiler-ref/tsconfig.tsbuildinfo'))).toBe(false);
});
