import { z } from 'zod';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { GspotError } from '#cli/errors.ts';
import { runTool } from '#cli/tools/run.ts';
import { isDeepStrictEqual } from 'node:util';
import { readText } from '#cli/system/file-reads.ts';
import { scratchFolder } from '#cli/system/files.ts';
import { unavailableNote } from '#cli/tools/find.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import { UV_LOCKFILE_NAME } from '#cli/config/parsers/lockfiles.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { normalizedPythonPackage } from '#cli/parsers/dependency-files.ts';
import { parsePythonSettings, writePythonSettings } from '#cli/tools/python/settings.ts';
import { installationDiagnostics, assertCredentialFreeLockfile } from '#cli/tools/diagnostics.ts';
import { DOT_GSPOT, UV_LOCKFILE, PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

import type {
    UvExecution,
    PythonPreparation,
    PythonRequirement,
    PythonToolProject,
    PythonToolLockfile,
} from '#cli/types/tools/project.ts';
import {
    UV_TOOL,
    UV_SETTINGS_FILE,
    UV_RUN_ARGUMENTS,
    UV_VENV_ARGUMENTS,
    CONSTRAINT_OPERATOR,
    PINNED_PACKAGE_NAME,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    PYTHON_ENVIRONMENT_FOLDER,
} from '#cli/config/tools/python.ts';

// A temporary lockfile must not publish credentials supplied through repository index settings.
function readPythonLockfile(work: string, credentials: string[], project: PythonToolProject): string {
    const lockfile = readFileSync(join(work, UV_LOCKFILE_NAME), 'utf8');
    assertCredentialFreeLockfile(
        lockfile,
        credentials,
        new GspotError(
            'installation',
            'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
        ),
    );
    if (!pythonLockfileMatches(project, lockfile))
        throw new GspotError(
            'installation',
            'The uv lockfile does not match the tool project. Existing files were preserved.',
        );
    return lockfile;
}

// uv runs inside the selected tool project and uses its exact Python requirement.
async function runUv({
    work,
    args,
    executable,
    credentials,
    timeoutSeconds,
    steps,
    configFile = join(work, UV_SETTINGS_FILE),
}: UvExecution): Promise<SpawnResult> {
    const command = [executable, ...args, '--project', work, '--directory', work, '--config-file', configFile];
    steps.push(command);
    const result = await runTool(command, {
        cwd: work,
        timeoutSeconds,
        env: { UV_PROJECT_ENVIRONMENT: join(work, PYTHON_ENVIRONMENT_FOLDER) },
    });
    if (result.missing)
        throw new GspotError(
            'tool',
            unavailableNote(toolDeclaration(configurationManifests().values(), UV_TOOL), {
                name: UV_TOOL,
                state: 'missing',
            }),
        );
    if (result.code !== 0)
        throw new GspotError(
            'installation',
            `UV ${String(args[0])} failed (exit ${String(result.code)}). Check Python downloads and index settings, then run: gspot install.\n${installationDiagnostics(result, credentials)}`,
        );
    return result;
}

// Requirements as one text each, with the package name normalized, in order, so a project and its lockfile compare.
function requirementTexts(requirements: PythonRequirement[]): string[] {
    return requirements
        .map(({ name, specifier }) => `${normalizedPythonPackage(name)}${specifier}`)
        .toSorted((left, right) => left.localeCompare(right));
}

// Compare the lockfile constraints with the project's transitive dependency constraints.
function constraintsMatch(constraints: string[], recorded: PythonToolLockfile): boolean {
    const declared = constraints.map((constraint) => {
        const operator = constraint.search(CONSTRAINT_OPERATOR);
        return { name: constraint.slice(0, operator), specifier: constraint.slice(operator) };
    });
    return isDeepStrictEqual(requirementTexts(declared), requirementTexts(recorded.manifest.constraints));
}

const requirementSchema = z.object({
    name: z.string(),
    specifier: z.string(),
} satisfies SchemaShape<PythonRequirement>);

const uvLockSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
    manifest: z
        .object({ constraints: z.array(requirementSchema).default([]) } satisfies SchemaShape<
            PythonToolLockfile['manifest']
        >)
        .default({ constraints: [] }),
    package: z.array(
        z.object({
            name: z.string(),
            version: z.string(),
            source: z.looseObject({ virtual: z.string().optional() } satisfies SchemaShape<
                Pick<PythonToolLockfile['package'][number]['source'], 'virtual'>
            >),
            metadata: z
                .object({ 'requires-dist': z.array(requirementSchema).default([]) } satisfies SchemaShape<
                    PythonToolLockfile['package'][number]['metadata']
                >)
                .default({ 'requires-dist': [] }),
        } satisfies SchemaShape<PythonToolLockfile['package'][number]>),
    ),
} satisfies SchemaShape<PythonToolLockfile>) satisfies z.ZodType<PythonToolLockfile>;

/**
 * Resolve the Python tool lockfile outside the repository before writing it.
 *
 * @param manifest the generated pyproject.toml.
 * @param owner the repository reader.
 * @param preparation the repository and uv executable lookup.
 * @param steps the commands attempted during lockfile creation.
 *
 * @returns credential-free lockfile bytes.
 */
export async function preparePythonLockfile(
    manifest: GeneratedFile,
    owner: Pick<SafeFolder, 'read'>,
    preparation: PythonPreparation,
    steps: (readonly string[])[],
): Promise<GeneratedFile> {
    const project = parse(manifest.content) as PythonToolProject;
    const original = owner.read(UV_LOCKFILE);
    const recorded = original?.bytes.toString('utf8');
    if (pythonLockfileMatches(project, recorded)) {
        const { credentials } = parsePythonSettings(preparation.root, {
            uv: readText(preparation.root, UV_SETTINGS_FILE),
            project: readText(preparation.root, PYPROJECT_TOML),
        });
        assertCredentialFreeLockfile(
            recorded,
            credentials,
            new GspotError(
                'installation',
                'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
            ),
        );
        return {
            path: UV_LOCKFILE,
            content: recorded,
            kind: 'lock',
            ...(original === undefined ? {} : { read: original }),
        };
    }
    using scratch = scratchFolder();
    const work = scratch.path;
    writeFileSync(join(work, PYPROJECT_TOML), manifest.content);

    const credentials = writePythonSettings(preparation.root, work);
    const executable = preparation.uvPath;
    await runUv({
        work,
        args: UV_LOCKFILE_ARGUMENTS,
        executable,
        credentials,
        timeoutSeconds: preparation.timeoutSeconds,
        steps,
    });
    return {
        path: UV_LOCKFILE,
        content: readPythonLockfile(work, credentials, project),
        kind: 'lock',
        ...(original === undefined ? {} : { read: original }),
    };
}

/**
 * Install the frozen Python tool project in .gspot.
 *
 * @param root the repository root.
 * @param owner the repository reader.
 * @param executable the uv executable.
 * @param timeoutSeconds the tool_timeout_seconds setting.
 * @param steps the commands attempted during installation.
 *
 * @returns the installation summary.
 */
export async function installPythonTools(
    root: string,
    owner: Pick<SafeFolder, 'read'>,
    executable: string,
    timeoutSeconds: number,
    steps: (readonly string[])[],
): Promise<string> {
    const manifest = owner.read(PYTHON_TOOL_PROJECT_FILE);
    if (manifest === undefined) return '';
    const work = join(root, DOT_GSPOT);

    using settings = scratchFolder();
    const credentials = writePythonSettings(root, settings.path);
    for (const args of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        await runUv({
            work,
            args,
            executable,
            credentials,
            timeoutSeconds,
            steps,
            configFile: join(settings.path, UV_SETTINGS_FILE),
        });
    }
    return 'installed locked Python tools under .gspot/.venv';
}

/**
 * Run a pinned Python check over the scope's installed project dependencies.
 *
 * @param selection the scope's selected tool declarations.
 * @param scopeRoot the project folder.
 * @param command the target executable and its arguments.
 *
 * @returns the uv project command without synchronizing the project or its lockfile.
 */
export function pythonProjectCommand(
    selection: ScopeSelection,
    scopeRoot: string,
    command: [string, ...string[]],
): string[] {
    const tool = toolDeclaration(selection.selected, command[0]);
    const packagePin = tool.installers['pypi'];
    if (packagePin?.version === undefined)
        throw new GspotError('tool', `The ${tool.name} check has no pinned Python package declaration.`);
    return [
        UV_TOOL,
        ...UV_RUN_ARGUMENTS,
        '--project',
        scopeRoot,
        '--with',
        `${packagePin.name}==${packagePin.version}`,
        ...command,
    ];
}

/**
 * Compare a Python tool project with the pins and constraints recorded in its uv lockfile.
 *
 * @param project the parsed generated pyproject.toml.
 * @param lockfile the recorded uv.lock contents.
 *
 * @returns whether both validated inputs describe the same requirements.
 */
export function pythonLockfileMatches(project: PythonToolProject, lockfile: string | undefined): lockfile is string {
    if (lockfile === undefined) return false;
    const manifest = project.project;
    let document: unknown;
    try {
        document = parse(lockfile);
    } catch {
        return false;
    }
    const validated = uvLockSchema.safeParse(document);
    if (!validated.success) return false;
    const recorded = validated.data;
    if (!constraintsMatch(project.tool.uv['constraint-dependencies'] ?? [], recorded)) return false;
    const projectEntry = recorded.package.find((entry) => entry.name === manifest.name && entry.source.virtual === '.');
    if (projectEntry === undefined || recorded['requires-python'] !== manifest['requires-python']) return false;
    const expected = manifest.dependencies
        .map((value) => value.replace(PINNED_PACKAGE_NAME, normalizedPythonPackage))
        .toSorted((left, right) => left.localeCompare(right));
    return isDeepStrictEqual(requirementTexts(projectEntry.metadata['requires-dist']), expected);
}
