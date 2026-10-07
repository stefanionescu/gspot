import { parse } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { normalizedPythonPackage } from '#cli/parsers/packages.ts';
import type { PythonRequirement, PythonToolLockfile } from '#cli/types/tools/python.ts';
import { lockfileSchema, pythonToolProjectSchema } from '#cli/parsers/schema/python/tools.ts';

// Requirements as one text each, with the package name normalized, in order, so a project and its lockfile compare.
function requirementTexts(requirements: PythonRequirement[]): string[] {
    return requirements
        .map(({ name, specifier }) => `${normalizedPythonPackage(name)}${specifier}`)
        .toSorted((left, right) => left.localeCompare(right));
}

// Whether the lockfile was resolved under the constraints the project sets on transitive packages.
function constraintsMatch(constraints: string[], recorded: PythonToolLockfile): boolean {
    const declared = constraints.map((constraint) => {
        const operator = constraint.search(/[<>!~=]/u);
        return { name: constraint.slice(0, operator), specifier: constraint.slice(operator) };
    });
    return isDeepStrictEqual(requirementTexts(declared), requirementTexts(recorded.manifest.constraints));
}

/**
 * Compare a Python tool project with the pins and constraints recorded in its uv lockfile.
 * @param project the generated pyproject.toml contents
 * @param lockfile the recorded uv.lock contents
 * @returns whether both validated inputs describe the same requirements
 */
export function pythonLockfileMatches(project: string, lockfile: string | undefined): lockfile is string {
    if (lockfile === undefined) return false;
    try {
        const parsed = pythonToolProjectSchema.parse(parse(project));
        const manifest = parsed.project;
        const recorded = lockfileSchema.parse(parse(lockfile));
        if (!constraintsMatch(parsed.tool.uv['constraint-dependencies'], recorded)) return false;
        const projectEntry = recorded.package.find(
            (entry) => entry.name === manifest.name && entry.source.virtual === '.',
        );
        if (projectEntry === undefined || recorded['requires-python'] !== manifest['requires-python']) return false;
        const expected = manifest.dependencies
            .map((value) => value.replace(/^[^=]+/u, normalizedPythonPackage))
            .toSorted((left, right) => left.localeCompare(right));
        return isDeepStrictEqual(requirementTexts(projectEntry.metadata['requires-dist']), expected);
    } catch {
        return false;
    }
}
