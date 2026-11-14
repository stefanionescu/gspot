import type { Session } from '#cli/types/tools.ts';
import { chmodSync, writeFileSync } from 'node:fs';
import type { ParsedTsconfig } from '#cli/types/parsers.ts';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { GSPOT_FOLDER, PRIVATE_FILE } from '#cli/config/system.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { requireTypescript } from '#cli/system/package/typescript.ts';
import { readTsconfig, listSourceFiles } from '#cli/parsers/projects/tsconfig.ts';
import type { TypeScriptReferenceCopy } from '#cli/types/configurations/shared.ts';

import {
    PATHS_BASE_OPTION,
    TSC_REFERENCE_BUNDLE,
    TSCONFIG_TSBUILDINFO,
    TSC_CONFIG_INPUT_PATHS,
    TSC_COMPILER_INPUT_PATHS,
    TSC_REFERENCE_OUTPUT_FOLDER,
} from '#cli/config/configurations/shared.ts';

function convertToCopyPath(value: unknown, copy: TypeScriptReferenceCopy): unknown {
    if (Array.isArray(value)) return value.map((path: unknown) => convertToCopyPath(path, copy));
    return typeof value === 'string' && isAbsolute(value) && isInside(relative(copy.root, value))
        ? join(copy.copyRoot, relative(copy.root, value))
        : value;
}

function buildReferenceTsconfig(
    copy: TypeScriptReferenceCopy & { path: string; config: ParsedTsconfig },
): Record<string, unknown> {
    const ts = requireTypescript();
    const { root, copyRoot, path, config } = copy;
    const output = join(copyRoot, GSPOT_FOLDER, TSC_REFERENCE_OUTPUT_FOLDER, relative(root, path));
    const base = (config.options.baseUrl ?? config.options[PATHS_BASE_OPTION]) as string;
    const paths =
        config.options.paths === undefined
            ? undefined
            : Object.fromEntries(
                  Object.entries(config.options.paths).map(([name, aliases]) => {
                      return [name, aliases.map((alias) => convertToCopyPath(resolve(base, alias), copy))];
                  }),
              );
    return {
        ...config.raw,
        ...Object.fromEntries(TSC_CONFIG_INPUT_PATHS.map((name) => [name, convertToCopyPath(config.raw[name], copy)])),
        references: config.projectReferences?.map((reference) => ({
            ...reference,
            path: join(copyRoot, relative(root, ts.resolveProjectReferencePath(reference))),
        })),
        compilerOptions: {
            ...config.raw.compilerOptions,
            ...Object.fromEntries(
                TSC_COMPILER_INPUT_PATHS.map((name) => [name, convertToCopyPath(config.options[name], copy)]),
            ),
            ...(paths !== undefined && { paths }),
            outDir: output,
            ...(config.options.declarationDir !== undefined && { declarationDir: output }),
            ...(config.options.outFile !== undefined && { outFile: join(output, TSC_REFERENCE_BUNDLE) }),
            tsBuildInfoFile: join(output, TSCONFIG_TSBUILDINFO),
        },
    };
}

/**
Rewrites each copied tsconfig so reference builds write their output into the copy.
*/
export function writeReferenceProjects(copy: TypeScriptReferenceCopy): void {
    const { root, copyRoot, projects, cache } = copy;
    const configurations = new Map([
        ...projects,
        ...projects.values().flatMap((config) =>
            config.extendedTsconfigFiles.map((path) => {
                return [path, readTsconfig(root, path, cache) as ParsedTsconfig] as const;
            }),
        ),
    ]);
    for (const [path, config] of configurations) {
        const target = join(copyRoot, relative(root, path));
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, JSON.stringify(buildReferenceTsconfig({ ...copy, path, config })));
    }
}

export function listCompilerFiles(session: Session, projects: Iterable<readonly [string, ParsedTsconfig]>): string[] {
    return [...projects]
        .flatMap(([scopePath, config]) => [
            ...config.tsconfigFiles,
            ...listSourceFiles(session.root, scopePath, session.cache, config).map((source) => source.fileName),
        ])
        .map((path) => convertToPosixPath(relative(session.root, path)))
        .filter(isInside);
}
