import { chmodSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

import {
    JAVASCRIPT_TSC_COMMAND,
    JSCONFIG_TSBUILDINFO,
    TSC_UNFORMATTED_OUTPUT,
} from '#cli/config/configurations/javascript.ts';
import { JSCONFIG_FILE, RAN_STATUSES } from '#cli/config/engine.ts';
import { DECLARATION_EXTENSIONS, PRIVATE_FILE } from '#cli/config/system.ts';
import { keepListedFindings } from '#cli/configurations/ignores.ts';
import { addTsbuildinfoFlag, listCompilerFiles } from '#cli/configurations/tsc/compiler.ts';
import { readAuthoredTypes } from '#cli/configurations/tsc/scope-tsconfig.ts';
import { createCheckCopy, createCopy } from '#cli/engine/copies/files.ts';
import { extractConfigName, listCheckedFiles } from '#cli/engine/files.ts';
import { buildBaseResult, mergeCheckResults, restoreCommandPaths } from '#cli/engine/results.ts';
import { buildMissingFileStop, runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { getConfigPath } from '#cli/engine/tool-runs/placeholders.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath, extractExtension, isInside } from '#cli/system/paths.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';
import type { ParsedTsconfig } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function buildScopeCompilerProject(
    session: Session,
    scopePath: string,
    config: ParsedTsconfig,
): Pick<ParsedTsconfig, 'fileNames' | 'options'> {
    const ts = requireTypescript();
    const { root, repository } = session;
    const sources = repository.files.filter((file) => file.kind === 'source');
    const files = new Set(
        listOwnFiles(sources, repository.scopeFolders, scopePath).map((file) =>
            convertToPosixPath(join(root, file.path)),
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

async function checkJavascriptTsc(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const scopePath = planned.scope.path;
    if (listCheckedFiles(session.scopes, planned).length === 0)
        return { ...buildBaseResult(planned, session), fileCount: 0 };
    const target = getConfigPath(session, planned, extractConfigName(JSCONFIG_FILE));
    const generated = readTsconfig(session.root, join(session.root, target), session.cache);
    if (generated === undefined) throw buildMissingFileStop(target);
    const project = {
        ...generated,
        ...buildScopeCompilerProject(session, scopePath, generated),
    };
    if (project.fileNames.length === 0) return { ...buildBaseResult(planned, session), fileCount: 0 };
    const prerequisites = listCompilerFiles(session, [[scopePath, project]]);
    using folder = await createCheckCopy(session, planned, [target, ...prerequisites]);
    const generatedPath = join(folder.path, target);
    chmodSync(generatedPath, PRIVATE_FILE);
    const { files, types } = readAuthoredTypes(
        { path: join(session.root, scopePath, JSCONFIG_FILE), config: project },
        dirname(generatedPath),
    );
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...generated.raw,
            compilerOptions: {
                ...generated.raw.compilerOptions,
                typeRoots: project.options.typeRoots?.map((path) => join(folder.path, relative(session.root, path))),
                ...(types !== undefined && { types }),
            },
            files: [
                ...project.fileNames.map((path) => {
                    const copied = join(folder.path, relative(session.root, path));
                    return convertToPosixPath(relative(dirname(generatedPath), copied));
                }),
                ...files,
            ],
            include: [],
            exclude: [],
        }),
    );
    const command = [...JAVASCRIPT_TSC_COMMAND, generatedPath, ...TSC_UNFORMATTED_OUTPUT];
    addTsbuildinfoFlag(command, project.options, folder.path, JSCONFIG_TSBUILDINFO);
    const result = await runCommandCheck({ ...session, root: folder.path }, planned, { command });
    return restoreCommandPaths(result, folder.path, session.root);
}

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
    // Knip can read a folder that Git ignores, and each file there reports as unused.
    'javascript/knip': {
        run: async (session, planned) => keepListedFindings(session, await runCommandCheck(session, planned)),
    },
    'javascript/tsc': { run: checkJavascriptTsc },
    'javascript/biome': { run: checkJavascriptBiome },
};
