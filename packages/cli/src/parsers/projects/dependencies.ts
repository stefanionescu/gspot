import { posix } from 'node:path';
import { LINE_BREAK } from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { RunCache } from '#cli/types/system.ts';
import { findText } from '#cli/system/files/reads.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { listSwiftCallArguments } from '#cli/parsers/code/swift.ts';
import { pipfileSchema, pyprojectSchema, packageJsonSchema } from '#cli/schemas/parsers.ts';

import type {
    Pyproject,
    PackageJson,
    Dependencies,
    DependencyFile,
    PythonDependency,
    DependencyFileParser,
} from '#cli/types/parsers.ts';
import {
    PIPFILE,
    GIT_SUFFIX,
    PACKAGE_JSON,
    PYTEST_TABLE,
    PACKAGE_SWIFT,
    INLINE_COMMENT,
    PYPROJECT_TOML,
    RUNTIME_COMMAND,
    REQUIREMENT_NAME,
    REQUIREMENTS_TXT,
    LINE_CONTINUATION,
    JAVASCRIPT_RUNTIMES,
    REQUIREMENT_NAME_END,
    PYTHON_NAME_SEPARATORS,
} from '#cli/config/parsers/projects.ts';

function parseRequirementName(requirement: string): string | undefined {
    const trimmed = requirement.trim();
    const end = trimmed.search(REQUIREMENT_NAME_END);
    const name = end === -1 ? trimmed : trimmed.slice(0, end);
    return REQUIREMENT_NAME.test(name) ? normalizePythonName(name) : undefined;
}

function convertPythonDependencies(maps: Array<Record<string, PythonDependency>>): Dependencies {
    return Object.fromEntries(
        maps
            .flatMap((map) => Object.entries(map))
            .map(
                ([name, value]) =>
                    [normalizePythonName(name), typeof value === 'string' ? value : JSON.stringify(value)] as const,
            )
            .filter(([name]) => name !== 'python'),
    );
}

function listPythonRequirements(path: string, parsed: Pyproject): Dependencies {
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
                    'parse',
                    `${path}: ${spec} is not a PEP 508 requirement. Write it as name @ url, then run gspot again.`,
                );
            return [name, spec];
        }),
    );
}

function listPythonDependencies(path: string, parsed: Pyproject): Dependencies {
    const poetry = parsed.tool?.poetry;
    const maps = [poetry?.dependencies];
    if (poetry?.group !== undefined) for (const group of Object.values(poetry.group)) maps.push(group.dependencies);
    return Object.assign(
        parsed.tool?.pytest === undefined ? {} : { pytest: PYTEST_TABLE },
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
    const installed: Dependencies = {
        ...parsed.dependencies,
        ...parsed.devDependencies,
        ...parsed.optionalDependencies,
    };
    const dependencies: Dependencies = {
        ...installed,
        ...parsed.peerDependencies,
    };
    return {
        path,
        kind: PACKAGE_JSON,
        dependencies,
        installed,
        runtimes: detectPackageRuntimes(path, parsed),
        ...(parsed.scripts !== undefined && { scripts: Object.values(parsed.scripts) }),
        ...(parsed.type !== undefined && { moduleType: parsed.type }),
    };
}

function parsePipfile(path: string, text: string): DependencyFile {
    const parsed = parseTomlFile(path, text, pipfileSchema);
    const dependencies = convertPythonDependencies(
        [parsed.packages, parsed['dev-packages']].filter(
            (map): map is Record<string, PythonDependency> => map !== undefined,
        ),
    );
    return { path, kind: PIPFILE, dependencies, installed: dependencies };
}

function parsePyproject(path: string, text: string): DependencyFile {
    const parsed = parseTomlFile(path, text, pyprojectSchema);
    const dependencies = listPythonDependencies(path, parsed);
    return {
        path,
        kind: PYPROJECT_TOML,
        dependencies,
        installed: dependencies,
    };
}

async function parseSwiftPackage(path: string, text: string): Promise<DependencyFile> {
    const dependencies: Dependencies = {};
    using tree = await parseSource('swift', text);
    const calls = tree.rootNode
        .descendantsOfType('call_expression')
        .filter((call) => call.namedChild(0)?.text === '.package');
    for (const call of calls) {
        const value = listSwiftCallArguments(call)
            .find((argument) => argument.childForFieldName('name')?.text === 'url')
            ?.childForFieldName('value');
        if (value?.type !== 'line_string_literal' || value.namedChildren.some((node) => node.type !== 'line_str_text'))
            continue;
        const url = value.namedChildren.map((node) => node.text).join('');
        dependencies[posix.basename(url, GIT_SUFFIX)] = url;
    }
    return {
        path,
        kind: PACKAGE_SWIFT,
        dependencies,
        installed: dependencies,
    };
}

export function normalizePythonName(name: string): string {
    return name.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '-');
}

export function parseRequirements(path: string, text: string): DependencyFile {
    const dependencies: Dependencies = {};
    for (const line of text.replaceAll(LINE_CONTINUATION, '').split(LINE_BREAK)) {
        const comment = line.search(INLINE_COMMENT);
        const spec = (comment === -1 ? line : line.slice(0, comment)).trim();
        const name = parseRequirementName(spec);
        if (name !== undefined) dependencies[name] = spec;
    }
    return {
        path,
        kind: REQUIREMENTS_TXT,
        dependencies,
        installed: dependencies,
    };
}

export function readPackageJson(source: string | RunCache, path: string): PackageJson | undefined {
    const text = findText(source, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

export const DEPENDENCY_FILE_PARSERS: ReadonlyMap<string, DependencyFileParser> = new Map<string, DependencyFileParser>(
    [
        [PACKAGE_JSON, parsePackageJson],
        [PYPROJECT_TOML, parsePyproject],
        [PACKAGE_SWIFT, parseSwiftPackage],
        [PIPFILE, parsePipfile],
    ],
);
