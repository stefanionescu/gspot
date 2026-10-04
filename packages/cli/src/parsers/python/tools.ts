import { parse } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, resolve as absolutePath } from 'node:path';
import { registryPasswords } from '#cli/parsers/credentials.ts';
import { normalizedPythonPackage } from '#cli/parsers/packages.ts';
import { HTTP_URL, URL_SCHEME, INDEX_SETTINGS } from '#cli/config/parsers/python-tools.ts';

import type {
    PythonToolLock,
    PythonRequirement,
    PythonIndexSettings,
    PythonSettingsSources,
} from '#cli/types/parsers/python.ts';
import {
    lockSchema,
    uvIndexSchema,
    pyprojectSchema,
    uvIndexesSchema,
    uvFindLinksSchema,
    uvProjectSettingsSchema,
} from '#cli/parsers/schema/python/tools.ts';

// Requirements as one text each, with the package name normalized, in order, so a project and its lock compare.
function requirementTexts(requirements: PythonRequirement[]): string[] {
    return requirements
        .map(({ name, specifier }) => `${normalizedPythonPackage(name)}${specifier}`)
        .toSorted((left, right) => left.localeCompare(right));
}

// Whether the lock was resolved under the constraints the project sets on transitive packages.
function constraintsMatch(constraints: string[], recorded: PythonToolLock): boolean {
    const declared = constraints.map((constraint) => {
        const operator = constraint.search(/[<>!~=]/u);
        return { name: constraint.slice(0, operator), specifier: constraint.slice(operator) };
    });
    return isDeepStrictEqual(requirementTexts(declared), requirementTexts(recorded.manifest.constraints));
}

// Preserve absolute URLs and paths; resolve an authored local index against its repository.
function indexLocation(root: string, value: string): string {
    if (URL_SCHEME.test(value)) return value;
    if (isAbsolute(value)) return value;
    return absolutePath(root, value);
}

/**
 * Compare a private Python project with the pins and constraints recorded in its uv lock.
 * @param project the generated pyproject.toml contents
 * @param lock the recorded uv.lock contents
 * @returns whether both validated inputs describe the same requirements
 */
export function pythonLockMatches(project: string, lock: string | undefined): lock is string {
    if (lock === undefined) return false;
    try {
        const parsed = pyprojectSchema.parse(parse(project));
        const manifest = parsed.project;
        const recorded = lockSchema.parse(parse(lock));
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

/**
 * Read repository index settings and resolve their local paths for a temporary uv project.
 * @param root the repository root for resolving local index paths
 * @param sources the authored uv.toml and pyproject.toml contents
 * @returns selected settings and passwords excluded from generated locks and diagnostics
 */
export function parsePythonSettings(root: string, sources: PythonSettingsSources): PythonIndexSettings {
    const parsed = parse(sources.uv ?? sources.project ?? '');
    const table = sources.uv === undefined ? uvProjectSettingsSchema.parse(parsed).tool.uv : parsed;
    const selected = Object.fromEntries(Object.entries(table).filter(([key]) => INDEX_SETTINGS.has(key)));
    if (selected['find-links'] !== undefined)
        selected['find-links'] = uvFindLinksSchema
            .parse(selected['find-links'])
            .map((value) => indexLocation(root, value));
    if (selected['index'] !== undefined)
        selected['index'] = uvIndexesSchema.parse(selected['index']).map((index) => ({
            ...index,
            url: indexLocation(root, index.url),
        }));
    const credentials = Object.entries(selected).flatMap(([key, value]) => {
        const entries: unknown[] = Array.isArray(value) ? value : [value];
        const settingEntries =
            key === 'index'
                ? entries.map((entry) => uvIndexSchema.parse(entry).url)
                : entries.filter((entry) => typeof entry === 'string');
        return settingEntries.filter((value) => HTTP_URL.test(value)).flatMap((value) => registryPasswords(value));
    });
    return { settings: selected, credentials };
}
