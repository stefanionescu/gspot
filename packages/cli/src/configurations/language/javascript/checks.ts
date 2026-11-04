import { CheckStop } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { chmodSync, writeFileSync } from 'node:fs';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { ParsedTsconfig } from '#cli/types/parsers.ts';
import { join, dirname, extname, relative } from 'node:path';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { RAN_STATUSES, JSCONFIG_FILE } from '#cli/config/engine.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { createCopy, createCheckCopy } from '#cli/engine/copies/files.ts';
import { listCheckedFiles, extractConfigName } from '#cli/engine/files.ts';
import { PRIVATE_FILE, DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { listCompilerFiles, addTsbuildinfoFlag } from '#cli/configurations/tsc/compiler.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';
import { buildBaseResult, mergeCheckResults, restoreCommandPaths } from '#cli/engine/results.ts';

import {
    JSCONFIG_TSBUILDINFO,
    TSC_UNFORMATTED_OUTPUT,
    JAVASCRIPT_TSC_COMMAND,
} from '#cli/config/configurations/javascript.ts';

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
async function checkJavascriptTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const scopePath = planned.scope.path;
    if (listCheckedFiles(session.scopes, planned).length === 0)
        return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = getConfigPath(session, planned, extractConfigName(JSCONFIG_FILE));
    const generated = readTsconfig(session.root, join(session.root, target), session.cache);
    if (generated === undefined)
        throw new CheckStop('missing', `The generated file ${target} is missing. Run gspot install.`);
    const project = {
        ...generated,
        ...buildScopeCompilerProject(session, scopePath, generated),
    };
    if (project.fileNames.length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const prerequisites = listCompilerFiles(session, [[scopePath, project]]);
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
    const result = await runCommandCheck({ ...session, root: folder.path }, planned, { command });
    return restoreCommandPaths(result, folder.path, session.root);
}

/**
Run Biome on supported files and name copied Node shebang scripts as JavaScript.

@param session the repository and installed tools.
@param planned the scope and selected files.
*/
async function checkJavascriptBiome(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const files = listCheckedFiles(session.scopes, planned);
    const biomeExtensions = new Set(planned.check.files?.extensions);
    const groups = Map.groupBy(files, (file) => biomeExtensions.has(extname(file.path).toLowerCase()));
    const regular = groups.get(true) ?? [];
    let result = buildBaseResult(planned, session);
    if (regular.length > 0)
        result = mergeCheckResults(result, await runCommandCheck(session, { ...planned, files: regular }));
    const scripts = groups.get(false) ?? [];
    if (scripts.length === 0 || !RAN_STATUSES.has(result.status)) return result;
    const config = getConfigPath(session, planned, 'biome');
    using copy = await createCopy(session, [config]);
    const writer = openFiles(copy.path);
    const names = new Map<string, string>();
    const scriptFiles = scripts.map((file) => {
        const path = file.path + '.js';
        names.set(path, file.path);
        writer.write(path, { bytes: readBytes(session.cache, file.path), mode: PRIVATE_FILE });
        return { ...file, path };
    });
    const checked = await runCommandCheck({ ...session, root: copy.path }, { ...planned, files: scriptFiles });
    return mergeCheckResults(result, {
        ...restoreCommandPaths(checked, copy.path, session.root),
        findings: checked.findings.map((finding) => ({ ...finding, file: names.get(finding.file) ?? finding.file })),
    });
}

export const JAVASCRIPT_CHECKS: Readonly<Record<string, CheckCode>> = {
    'javascript/tsc': { run: checkJavascriptTsc },
    'javascript/biome': { run: checkJavascriptBiome },
};
