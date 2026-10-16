// Prepare and install the Python tool project.
import { z } from 'zod';
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { isDeepStrictEqual } from 'node:util';
import { parse } from '@decimalturn/toml-patch';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { formatUnavailableNote } from '#cli/tools/inspect.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: Lockfile orchestration and its producers share this hoisted result function within the tools module.
import { buildLockfileResult } from '#cli/tools/project-lockfiles.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { normalizePythonPackage } from '#cli/parsers/dependency-files.ts';
import { parsePythonSettings, writePythonSettings } from '#cli/tools/python/settings.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/tools/credentials.ts';
import { DOT_GSPOT, UV_LOCKFILE, PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

import type {
    UvExecution,
    PythonRequirement,
    PythonToolProject,
    PythonToolLockfile,
} from '#cli/types/tools/project.ts';
import {
    UV_TOOL,
    UV_SETTINGS_FILE,
    UV_RUN_ARGUMENTS,
    UV_VENV_ARGUMENTS,
    PINNED_PACKAGE_NAME,
    UV_INSTALL_ARGUMENTS,
    UV_LOCKFILE_ARGUMENTS,
    PYTHON_ENVIRONMENT_FOLDER,
    UV_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/tools/python.ts';

// A temporary lockfile must not publish credentials supplied through repository index settings.
function readPythonLockfile(work: string, credentials: string[], project: PythonToolProject): string {
    const row = LOCKFILES.find(({ client }) => client === 'uv') as Extract<
        (typeof LOCKFILES)[number],
        { client: 'uv' }
    >;
    const lockfile = readFileSync(join(work, row.file), 'utf8');
    assertCredentialFreeLockfile(lockfile, credentials, new GspotError('installation', UV_LOCKFILE_CREDENTIAL_MESSAGE));
    if (!isPythonLockfileCurrent(project, lockfile))
        throw new GspotError(
            'installation',
            'The uv lockfile does not match the tool project. Existing files were preserved.',
        );
    return lockfile;
}

// uv runs inside the selected tool project and uses its exact Python requirement.
async function runUv(
    context: InstallContext,
    { work, commandArguments, executable, credentials, configFile = join(work, UV_SETTINGS_FILE) }: UvExecution,
): Promise<SpawnResult> {
    const { steps } = context;
    const { timeoutSeconds } = context.session;
    const command = [
        executable,
        ...commandArguments,
        '--project',
        work,
        '--directory',
        work,
        '--config-file',
        configFile,
    ];
    steps.push(command);
    const result = await runTool(command, {
        cancelSignal: context.cancelSignal,
        cwd: work,
        timeoutSeconds,
        env: { UV_PROJECT_ENVIRONMENT: join(work, PYTHON_ENVIRONMENT_FOLDER) },
    });
    context.cancelSignal?.throwIfAborted();
    if (result.missing)
        throw new GspotError(
            'tool',
            formatUnavailableNote(getToolDeclaration(readManifests(context.session.reads).values(), UV_TOOL), {
                name: UV_TOOL,
                state: 'missing',
            }),
        );
    if (result.code !== 0)
        throw new GspotError(
            'installation',
            `UV ${String(commandArguments[0])} failed (exit ${String(result.code)}). Check Python downloads and index settings, then run: gspot install.\n${redactInstallOutput(result, credentials)}`,
        );
    return result;
}

// Requirements as one text each, with the package name normalized, in order, so a project and its lockfile compare.
function normalizeRequirements(requirements: PythonRequirement[]): string[] {
    return requirements
        .map(({ name, specifier }) => `${normalizePythonPackage(name)}${specifier}`)
        .toSorted((left, right) => left.localeCompare(right));
}

const requirementSchema = z.object({
    name: z.string(),
    specifier: z.string(),
} satisfies SchemaShape<PythonRequirement>);

const uvLockSchema = z.object({
    version: z.literal(1),
    'requires-python': z.string(),
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

/** Validate the generated Python tool project before matching or creating a lockfile. */
const pythonToolProjectSchema = z.object({
    project: z.object({
        name: z.string(),
        version: z.string(),
        'requires-python': z.string(),
        dependencies: z.array(z.string()),
    } satisfies SchemaShape<PythonToolProject['project']>),
    tool: z.object({
        uv: z.object({ package: z.literal(false) } satisfies SchemaShape<PythonToolProject['tool']['uv']>),
    } satisfies SchemaShape<PythonToolProject['tool']>),
} satisfies SchemaShape<PythonToolProject>) satisfies z.ZodType<PythonToolProject>;

/**
 * Resolve the Python tool lockfile outside the repository before writing it.
 *
 * @param context the selected tools, repository writer, session, and command log.
 * @param manifest the generated pyproject.toml.
 *
 * @returns credential-free lockfile bytes.
 */
async function preparePythonLockfile(context: InstallContext, manifest: GeneratedFile): Promise<GeneratedFile> {
    const { root, uvPath } = context.session;
    const owner = context.writer.files;
    const project = pythonToolProjectSchema.parse(parse(manifest.content));
    const original = owner.read(UV_LOCKFILE);
    const recorded = original?.bytes.toString('utf8');
    if (isPythonLockfileCurrent(project, recorded)) {
        const { credentials } = parsePythonSettings(root, {
            uv: readText(root, UV_SETTINGS_FILE),
            project: readText(root, PYPROJECT_TOML),
        });
        assertCredentialFreeLockfile(
            recorded,
            credentials,
            new GspotError('installation', UV_LOCKFILE_CREDENTIAL_MESSAGE),
        );
        return buildLockfileResult(UV_LOCKFILE, recorded, original);
    }
    using scratch = createScratchFolder();
    const work = scratch.path;
    writeFileSync(join(work, PYPROJECT_TOML), manifest.content);

    const credentials = writePythonSettings(root, work);
    const executable = uvPath;
    await runUv(context, {
        work,
        commandArguments: UV_LOCKFILE_ARGUMENTS,
        executable,
        credentials,
    });
    return buildLockfileResult(UV_LOCKFILE, readPythonLockfile(work, credentials, project), original);
}

/**
 * Install the frozen Python tool project in .gspot.
 *
 * @param context the selected tools, repository writer, session, and command log.
 * @param executable the uv executable.
 *
 * @returns the installation summary.
 */
async function installPythonTools(context: InstallContext, executable: string): Promise<string> {
    const { root } = context.session;
    const owner = context.writer.files;
    const manifest = owner.read(PYTHON_TOOL_PROJECT_FILE);
    if (manifest === undefined) return '';
    const work = join(root, DOT_GSPOT);

    using settings = createScratchFolder();
    const credentials = writePythonSettings(root, settings.path);
    for (const commandArguments of [UV_VENV_ARGUMENTS, UV_INSTALL_ARGUMENTS]) {
        await runUv(context, {
            work,
            commandArguments,
            executable,
            credentials,
            configFile: join(settings.path, UV_SETTINGS_FILE),
        });
    }
    const project = pythonToolProjectSchema.parse(parse(manifest.bytes.toString('utf8')));
    return `installed ${formatCount(project.project.dependencies.length, 'Python tool')} in .gspot/.venv`;
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
function buildUvRunCommand(selection: ScopeSelection, scopeRoot: string, command: [string, ...string[]]): string[] {
    const tool = getToolDeclaration(selection.selected, command[0]);
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
 * Identify the structured syntax errors emitted by the TOML parser.
 * @param error the failed lockfile parse.
 * @returns whether the failure reports a TOML syntax location.
 */
function isTomlSyntaxError(error: unknown): boolean {
    return error instanceof Error && 'line' in error && typeof error.line === 'number';
}

/**
 * Compare a Python tool project with the pins recorded in its uv lockfile.
 *
 * @param project the parsed generated pyproject.toml.
 * @param lockfile the recorded uv.lock contents.
 *
 * @returns whether both validated inputs describe the same requirements.
 */
function isPythonLockfileCurrent(project: PythonToolProject, lockfile: string | undefined): lockfile is string {
    if (lockfile === undefined) return false;
    const manifest = project.project;
    let document: unknown;
    try {
        document = parse(lockfile);
    } catch (error) {
        if (!isTomlSyntaxError(error)) throw error;
        return false;
    }
    const validated = uvLockSchema.safeParse(document);
    if (!validated.success) return false;
    const recorded = validated.data;
    const projectEntry = recorded.package.find((entry) => entry.name === manifest.name && entry.source.virtual === '.');
    if (projectEntry === undefined || recorded['requires-python'] !== manifest['requires-python']) return false;
    const expected = manifest.dependencies
        .map((value) => value.replace(PINNED_PACKAGE_NAME, normalizePythonPackage))
        .toSorted((left, right) => left.localeCompare(right));
    return isDeepStrictEqual(normalizeRequirements(projectEntry.metadata['requires-dist']), expected);
}

export {
    buildUvRunCommand,
    installPythonTools,
    preparePythonLockfile,
    pythonToolProjectSchema,
    isPythonLockfileCurrent,
};
