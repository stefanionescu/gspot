// Reads dependency declarations across supported package formats.
import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { parseTomlFile } from '#cli/parsers/toml/document.ts';
import { parseGrammarComments } from '#cli/parsers/comments.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/dependencies/package-json.ts';
import { pipfileSchema, pyprojectSchema } from '#cli/schemas/parsers/dependencies/python.ts';

import type {
    Pyproject,
    PackageJson,
    DependencyMap,
    DependencyFile,
    PythonDependency,
    DependencyFileParser,
} from '#cli/types/parsers/dependencies.ts';
import {
    PIPFILE,
    GIT_SUFFIX,
    PACKAGE_JSON,
    PACKAGE_SWIFT,
    INLINE_COMMENT,
    PYPROJECT_TOML,
    RUNTIME_COMMAND,
    REQUIREMENT_NAME,
    LINE_CONTINUATION,
    SWIFT_PACKAGE_URL,
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
    PYTHON_NAME_SEPARATORS,
} from '#cli/config/parsers/dependencies.ts';

// A requirement names a distribution: letters or digits at both ends, dots, dashes, and underscores between.
function parseRequirementName(spec: string): string | undefined {
    const trimmed = spec.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? trimmed : trimmed.slice(0, end);
    if (!REQUIREMENT_NAME.test(name)) return undefined;
    return name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-');
}

function convertPythonDependencies(maps: Record<string, PythonDependency>[]): DependencyMap {
    return Object.fromEntries(
        maps
            .flatMap((map) => Object.entries(map))
            .map(
                ([name, value]) =>
                    [
                        name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-'),
                        typeof value === 'string' ? value : JSON.stringify(value),
                    ] as const,
            )
            .filter(([name]) => name !== 'python'),
    );
}

function listPythonRequirements(parsed: Pyproject): DependencyMap {
    const project = parsed.project;
    const groups = [
        ...(project?.dependencies ?? []),
        ...(project?.['optional-dependencies'] === undefined
            ? []
            : Object.values(project['optional-dependencies'])
        ).flat(),
        ...(parsed['dependency-groups'] === undefined ? [] : Object.values(parsed['dependency-groups']))
            .flat()
            .filter((entry) => typeof entry === 'string'),
    ];
    return Object.fromEntries(
        groups.map((spec) => {
            const name = parseRequirementName(spec);
            if (name === undefined) throw new Error(`Invalid Python dependency requirement: ${spec}`);
            return [name, spec];
        }),
    );
}

function listPythonDependencies(parsed: Pyproject): DependencyMap {
    const poetry = parsed.tool?.poetry;
    const maps = [poetry?.dependencies];
    if (poetry?.group !== undefined) for (const group of Object.values(poetry.group)) maps.push(group.dependencies);
    // A tool.pytest table declares pytest use even when another installer supplies the package.
    return Object.assign(
        parsed.tool?.pytest === undefined ? {} : { pytest: 'tool.pytest' },
        listPythonRequirements(parsed),
        convertPythonDependencies(maps.filter((map): map is Record<string, PythonDependency> => map !== undefined)),
    );
}

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
    const parsed = parseTomlFile(path, text, pipfileSchema);
    const dependencies = convertPythonDependencies(
        [parsed.packages, parsed['dev-packages']].filter(
            (map): map is Record<string, PythonDependency> => map !== undefined,
        ),
    );
    return { path, kind: 'Pipfile', dependencies, installed: dependencies };
}

function parsePyproject(path: string, text: string): DependencyFile {
    const parsed = parseTomlFile(path, text, pyprojectSchema);
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

/**
 * Parse package requirements after removing line continuations and comments.
 *
 * @param path the repository-relative requirements file.
 * @param text authored distribution names, version specifiers, and installer options.
 * @returns the package declarations in the file.
 */
export function parseRequirements(path: string, text: string): DependencyFile {
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

export const PARSERS: Record<string, DependencyFileParser> = {
    [PACKAGE_JSON]: parsePackageJson,
    [PYPROJECT_TOML]: parsePyproject,
    [PACKAGE_SWIFT]: parseSwiftPackage,
    [PIPFILE]: parsePipfile,
};
