import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { pipfileSchema, pyprojectSchema, packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies.ts';

import type {
    Pyproject,
    PackageJson,
    DependencyMap,
    DependencyFile,
    PythonDependency,
    DependencyFileParser,
} from '#cli/types/parsers/projects/dependencies.ts';
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
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
    PYTHON_NAME_SEPARATORS,
} from '#cli/config/parsers/projects/dependencies.ts';

function parseRequirementName(requirement: string): string | undefined {
    const trimmed = requirement.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? trimmed : trimmed.slice(0, end);
    return REQUIREMENT_NAME.test(name) ? name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-') : undefined;
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

function listPythonRequirements(path: string, parsed: Pyproject): DependencyMap {
    const project = parsed.project;
    const groups = [
        ...(project?.dependencies ?? []),
        ...(project?.['optional-dependencies'] === undefined
            ? []
            : Object.values(project['optional-dependencies'])
        ).flat(),
        ...(parsed['dependency-groups'] === undefined ? [] : Object.values(parsed['dependency-groups']))
            .flat()
            .filter((value) => typeof value === 'string'),
    ];
    return Object.fromEntries(
        groups.map((spec) => {
            const name = parseRequirementName(spec);
            if (name === undefined)
                throw new GspotError(
                    'filesystem',
                    `${path}: ${spec} is not a PEP 508 requirement. Write it as name @ url, then run gspot again.`,
                );
            return [name, spec];
        }),
    );
}

function listPythonDependencies(path: string, parsed: Pyproject): DependencyMap {
    const poetry = parsed.tool?.poetry;
    const maps = [poetry?.dependencies];
    if (poetry?.group !== undefined) for (const group of Object.values(poetry.group)) maps.push(group.dependencies);
    return Object.assign(
        parsed.tool?.pytest === undefined ? {} : { pytest: 'tool.pytest' },
        listPythonRequirements(path, parsed),
        convertPythonDependencies(maps.filter((map): map is Record<string, PythonDependency> => map !== undefined)),
    );
}

function detectPackageRuntimes(path: string, packageJson: PackageJson): Record<string, string> {
    const runtimes: Record<string, string> = {};
    for (const runtime of JAVASCRIPT_RUNTIMES)
        if (packageJson.engines?.[runtime] !== undefined) runtimes[runtime] = `${runtime} in ${path} engines`;
    const scripts = packageJson.scripts === undefined ? [] : Object.entries(packageJson.scripts);
    for (const [name, command] of scripts) {
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
    const dependencies = listPythonDependencies(path, parsed);
    return {
        path,
        kind: 'pyproject.toml',
        dependencies,
        installed: dependencies,
    };
}

async function parseSwiftPackage(path: string, text: string): Promise<DependencyFile> {
    const dependencies: DependencyMap = {};
    const tree = await parseSource('swift', text);
    try {
        const calls = tree.rootNode
            .descendantsOfType('call_expression')
            .filter((call) => call.namedChild(0)?.text === '.package');
        for (const call of calls) {
            const argumentsNode = call.namedChildren
                .find((node) => node.type === 'call_suffix')
                ?.namedChildren.find((node) => node.type === 'value_arguments');
            const value = argumentsNode?.namedChildren
                .find((argument) => argument.childForFieldName('name')?.text === 'url')
                ?.childForFieldName('value');
            if (
                value?.type !== 'line_string_literal' ||
                value.namedChildren.some((node) => node.type !== 'line_str_text')
            )
                continue;
            const url = value.namedChildren.map((node) => node.text).join('');
            dependencies[posix.basename(url, GIT_SUFFIX)] = url;
        }
    } finally {
        tree.delete();
    }
    return {
        path,
        kind: PACKAGE_SWIFT,
        dependencies,
        installed: dependencies,
    };
}

/**
Parse package requirements after removing line continuations and comments.

@param path the repository-relative requirements file.
@param text authored distribution names, version specifiers, and installer options.
@returns the package declarations in the file.
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

export const PARSERS: ReadonlyMap<string, DependencyFileParser> = new Map<string, DependencyFileParser>([
    [PACKAGE_JSON, parsePackageJson],
    [PYPROJECT_TOML, parsePyproject],
    [PACKAGE_SWIFT, parseSwiftPackage],
    [PIPFILE, parsePipfile],
]);
