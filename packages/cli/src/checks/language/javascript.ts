import { GspotError } from '#cli/system/errors.ts';
import { chmodSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { buildBaseResult } from '#cli/runs/results.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import { JSCONFIG_FILE } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { extractConfigFileName } from '#cli/configurations/tools.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects/tsconfig.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { TSC_UNFORMATTED_OUTPUT } from '#cli/config/checks/cross-configuration/tsc/compiler.ts';
import { JSCONFIG_TSBUILDINFO, JAVASCRIPT_TSC_COMMAND } from '#cli/config/checks/language/javascript.ts';

import {
    listCompilerFiles,
    addTsbuildinfoFlag,
    restoreCommandPaths,
} from '#cli/checks/cross-configuration/tsc/compiler.ts';

function buildScopeCompilerProject(
    session: Session,
    scopePath: string,
    config: ParsedTsconfig,
): Pick<ParsedTsconfig, 'fileNames' | 'options'> {
    const ts = requireTypescript();
    const { root, repository } = session;
    const sources = repository.files.filter((file) => file.kind === 'source');
    const files = new Set(
        (Map.groupBy(sources, (file) => selectScopePath(file.path, repository.scopeFolders)).get(scopePath) ?? []).map(
            (file) => convertToPosixPath(join(root, file.path)),
        ),
    );
    return {
        fileNames: config.fileNames.filter(
            (path) => DECLARATION_EXTENSIONS.includes(extractExtension(path)) || files.has(path),
        ),
        options: {
            ...config.options,
            typeRoots: (
                ts.getEffectiveTypeRoots(
                    { ...config.options, configFilePath: join(root, scopePath, JSCONFIG_FILE) },
                    {},
                ) ?? []
            ).filter((path) => isInside(relative(root, path))),
        },
    };
}

/**
Type-checks JavaScript with the type declarations the project uses.

@param session the repository and its tools.
@param planned the JavaScript compiler check.
*/
export async function checkJavascriptTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const scope = planned.scope.path;
    if (listCheckedFiles(session.scopes, planned).length === 0)
        return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = getConfigFilePath(session, planned, extractConfigFileName(JSCONFIG_FILE));
    const generated = readTsconfig(session.root, join(session.root, target), session.reads);
    if (generated === undefined)
        throw new GspotError('tool', `The generated file ${target} is missing. Run gspot apply.`);
    const project = {
        ...generated,
        ...buildScopeCompilerProject(session, scope, generated),
    };
    if (project.fileNames.length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const prerequisites = listCompilerFiles(session, [[scope, project]]);
    using folder = await createCheckCopy(session, planned, [target, ...prerequisites]);
    const generatedPath = join(folder.path, target);
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...generated.raw,
            compilerOptions: {
                ...generated.raw.compilerOptions,
                typeRoots: project.options.typeRoots?.map((path) => join(folder.path, relative(session.root, path))),
            },
            files: project.fileNames.map((path) => {
                const copied = join(folder.path, relative(session.root, path));
                return convertToPosixPath(relative(dirname(generatedPath), copied));
            }),
            include: [],
            exclude: [],
        }),
    );
    const command = [...JAVASCRIPT_TSC_COMMAND, generatedPath, ...TSC_UNFORMATTED_OUTPUT];
    addTsbuildinfoFlag(command, project.options, folder.path, JSCONFIG_TSBUILDINFO);
    const result = await runCommandCheck(session, planned, {
        command,
        copyRoot: folder.path,
    });
    return restoreCommandPaths(result, folder.path, session.root);
}
