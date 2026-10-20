// Reads dependency declarations across supported package formats.
import { z } from 'zod';
import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { parseGrammarComments } from '#cli/parsers/comments.ts';

import type {
    Pyproject,
    PackageJson,
    DependencyMap,
    PoetrySettings,
    DependencyFile,
    PythonDependency,
    DependencyFileParser,
} from '#cli/types/parsers/dependency-files.ts';
import {
    PIPFILE,
    GIT_SUFFIX,
    PACKAGE_JSON,
    PACKAGE_SWIFT,
    INLINE_COMMENT,
    PYPROJECT_TOML,
    RUNTIME_COMMAND,
    REQUIREMENT_NAME,
    REQUIREMENTS_FILE,
    LINE_CONTINUATION,
    SWIFT_PACKAGE_URL,
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
    PYTHON_NAME_SEPARATORS,
} from '#cli/config/parsers/dependency-files.ts';

// A requirement names a distribution: letters or digits at both ends, dots, dashes, and underscores between.
function parseRequirementName(spec: string): string | undefined {
    const trimmed = spec.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? trimmed : trimmed.slice(0, end);
    if (!REQUIREMENT_NAME.test(name)) return undefined;
    return normalizePythonPackage(name);
}

function listPoetryDependencies(poetry: PoetrySettings | undefined): DependencyMap {
    const poetryGroups = [
        ...(poetry?.dependencies === undefined ? [] : [poetry.dependencies]),
        ...(poetry?.group === undefined ? [] : Object.values(poetry.group)).flatMap((entry) =>
            entry.dependencies === undefined ? [] : [entry.dependencies],
        ),
    ];
    const poetryEntries = poetryGroups
        .flatMap((group) => Object.entries(group))
        .map(
            ([name, value]) =>
                [normalizePythonPackage(name), typeof value === 'string' ? value : JSON.stringify(value)] as const,
        )
        .filter(([name]) => name !== 'python');
    return Object.fromEntries(poetryEntries);
}

function listPythonDependencies(parsed: Pyproject): DependencyMap {
    const { project = {} } = parsed;
    const groups = [
        ...(project.dependencies ?? []),
        ...(project['optional-dependencies'] === undefined
            ? []
            : Object.values(project['optional-dependencies'])
        ).flat(),
        ...(parsed['dependency-groups'] === undefined ? [] : Object.values(parsed['dependency-groups']))
            .flat()
            .filter((entry) => typeof entry === 'string'),
    ];
    // A tool.pytest table declares pytest use even when another installer supplies the package.
    const dependencies: DependencyMap = parsed.tool?.pytest === undefined ? {} : { pytest: 'tool.pytest' };
    return Object.assign(
        dependencies,
        Object.fromEntries(
            groups.map((spec) => {
                const name = parseRequirementName(spec);
                if (name === undefined) throw new Error(`Invalid Python dependency requirement: ${spec}`);
                return [name, spec];
            }),
        ),
        listPoetryDependencies(parsed.tool?.poetry),
    );
}

function parseRequirements(path: string, text: string): DependencyFile {
    const dependencies: DependencyMap = {};
    for (const line of text.replaceAll(LINE_CONTINUATION, '').split(/\r?\n/u)) {
        const comment = line.search(INLINE_COMMENT);
        const spec = (comment === -1 ? line : line.slice(0, comment)).trim();
        const name = parseRequirementName(spec);
        if (name !== undefined) dependencies[name] = spec;
    }
    return {
        path,
        kind: 'requirements.txt',
        dependencies,
        installed: dependencies,
    };
}

const readers: Record<string, DependencyFileParser> = {
    [PACKAGE_JSON]: parsePackageJson,
    [PYPROJECT_TOML]: parsePyproject,
    [PACKAGE_SWIFT]: parseSwiftPackage,
    [PIPFILE]: parsePipfile,
};

function detectPackageRuntimes(path: string, packageJson: PackageJson): Record<string, string> {
    const runtimes: Record<string, string> = {};
    for (const runtime of JAVASCRIPT_RUNTIMES)
        if (packageJson.engines?.[runtime] !== undefined) runtimes[runtime] = `${runtime} in ${path} engines`;
    for (const [name, command] of packageJson.scripts === undefined ? [] : Object.entries(packageJson.scripts)) {
        const runtime = RUNTIME_COMMAND.exec(command)?.[1];
        if (runtime !== undefined) runtimes[runtime] = `${path} script ${name}`;
    }
    return runtimes;
}

function parsePackageJson(path: string, text: string): DependencyFile {
    const parsed = parseJsonFile(path, text, packageJsonSchema);
    const installed: DependencyMap = { ...parsed.dependencies, ...parsed.devDependencies };
    const dependencies: DependencyMap = {
        ...installed,
        ...parsed.peerDependencies,
        ...parsed.optionalDependencies,
    };
    return {
        path,
        kind: 'package.json',
        dependencies,
        installed,
        runtimes: detectPackageRuntimes(path, parsed),
    };
}

function parsePipfile(path: string, text: string): DependencyFile {
    const parsed = pipfileSchema.parse(parseToml(text));
    const dependencies: DependencyMap = {};
    for (const [name, value] of Object.entries({ ...parsed.packages, ...parsed['dev-packages'] })) {
        dependencies[normalizePythonPackage(name)] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return { path, kind: 'Pipfile', dependencies, installed: dependencies };
}

function parsePyproject(path: string, text: string): DependencyFile {
    const parsed = pyprojectSchema.parse(parseToml(text));
    const dependencies = listPythonDependencies(parsed);
    return {
        path,
        kind: 'pyproject.toml',
        dependencies,
        installed: dependencies,
    };
}

async function parseSwiftPackage(path: string, text: string): Promise<DependencyFile> {
    const dependencies: DependencyMap = {};
    const comments = await parseGrammarComments('swift', text);
    const source = text
        .split('\n')
        .map((line, index) => {
            const comment = comments.find((entry) => entry.line === index + 1 && entry.text.startsWith('//'));
            return comment === undefined ? line : line.slice(0, line.lastIndexOf(comment.text));
        })
        .join('\n');
    for (const match of source.matchAll(SWIFT_PACKAGE_URL)) {
        const url = match[1] ?? '';
        const last = posix.basename(url);
        dependencies[last.endsWith(GIT_SUFFIX) ? last.slice(0, -GIT_SUFFIX.length) : last] = url;
    }
    return {
        path,
        kind: PACKAGE_SWIFT,
        dependencies,
        installed: dependencies,
    };
}

const stringList = z.array(z.string()) satisfies z.ZodType<string[]>;

const stringMap = z.record(z.string(), z.string()) satisfies z.ZodType<Record<string, string>>;

const dependencyGroups = z.record(z.string(), stringList) satisfies z.ZodType<Record<string, string[]>>;

const groupInclude = z.object({ 'include-group': z.string() } satisfies SchemaShape<{ 'include-group': string }>);

const dependencyGroup = z.array(
    z.union([z.string(), groupInclude]) satisfies z.ZodType<string | { 'include-group': string }>,
) satisfies z.ZodType<(string | { 'include-group': string })[]>;

const projectTable = z.object({
    dependencies: stringList.optional(),
    'optional-dependencies': dependencyGroups.optional(),
    scripts: stringMap.optional(),
    'requires-python': z.string().optional(),
} satisfies SchemaShape<NonNullable<Pyproject['project']>>);

const pythonDependencyDetail = z.record(z.string(), z.unknown()) satisfies z.ZodType<Record<string, unknown>>;

const pythonDependencyMap = z.record(
    z.string(),
    z.union([
        z.string(),
        pythonDependencyDetail,
        z.array(pythonDependencyDetail),
    ]) satisfies z.ZodType<PythonDependency>,
) satisfies z.ZodType<Record<string, PythonDependency>>;

const poetryGroup = z.object({ dependencies: pythonDependencyMap.optional() } satisfies SchemaShape<
    NonNullable<NonNullable<PoetrySettings>['group']>[string]
>);

const workspacePackages = z.object({ packages: stringList } satisfies SchemaShape<{ packages: string[] }>);

const devEngineEntry = z.object({ name: z.string().optional(), version: z.string().optional() } satisfies SchemaShape<{
    name?: string | undefined;
    version?: string | undefined;
}>);

const devEngines = z.object({
    packageManager: (
        z.union([devEngineEntry, z.array(devEngineEntry)]) satisfies z.ZodType<
            NonNullable<NonNullable<PackageJson['devEngines']>['packageManager']>
        >
    ).optional(),
} satisfies SchemaShape<NonNullable<PackageJson['devEngines']>>);

const poetryToolSchema = z.object({
    dependencies: pythonDependencyMap.optional(),
    group: z.record(z.string(), poetryGroup).optional(),
} satisfies SchemaShape<NonNullable<PoetrySettings>>);

const pipfileSchema = z.object({
    packages: pythonDependencyMap.optional(),
    'dev-packages': pythonDependencyMap.optional(),
} satisfies SchemaShape<{
    packages?: Record<string, PythonDependency> | undefined;
    'dev-packages'?: Record<string, PythonDependency> | undefined;
}>);

const pyprojectSchema = z.object({
    project: projectTable.optional(),
    'dependency-groups': z.record(z.string(), dependencyGroup).optional(),
    tool: z
        .object({ pytest: z.unknown().optional(), poetry: poetryToolSchema.optional() } satisfies SchemaShape<
            NonNullable<Pyproject['tool']>
        >)
        .optional(),
} satisfies SchemaShape<Pyproject>);

/**
 * Normalize a Python distribution name for package identity comparisons.
 *
 * @param name the distribution as written.
 * @returns the name in lower case with one hyphen between words.
 */
export function normalizePythonPackage(name: string): string {
    return name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-');
}

/**
 * Select the parser for a dependency file.
 *
 * @param path the repository-relative file that fields and parse errors name.
 * @returns the text parser, or undefined for an unsupported file name.
 */
export function selectDependencyFileParser(path: string): DependencyFileParser | undefined {
    const base = posix.basename(path);
    return REQUIREMENTS_FILE.test(path) ? parseRequirements : readers[base];
}

export const packageJsonSchema = z.looseObject({
    name: z.string().optional(),
    version: z.string().optional(),
    imports: z.record(z.string(), z.unknown()).optional(),
    files: stringList.optional(),
    private: z.boolean().optional(),
    packageManager: z.string().optional(),
    devEngines: devEngines.optional(),
    type: z.string().optional(),
    workspaces: (
        z.union([stringList, workspacePackages]) satisfies z.ZodType<NonNullable<PackageJson['workspaces']>>
    ).optional(),
    dependencies: stringMap.optional(),
    devDependencies: stringMap.optional(),
    peerDependencies: stringMap.optional(),
    optionalDependencies: stringMap.optional(),
    scripts: stringMap.optional(),
    engines: stringMap.optional(),
} satisfies SchemaShape<
    Pick<
        PackageJson,
        | 'name'
        | 'version'
        | 'imports'
        | 'files'
        | 'private'
        | 'packageManager'
        | 'devEngines'
        | 'type'
        | 'workspaces'
        | 'dependencies'
        | 'devDependencies'
        | 'peerDependencies'
        | 'optionalDependencies'
        | 'scripts'
        | 'engines'
    >
>);
