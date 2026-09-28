// The paths a policy names that must exist in the repository: scope directories and adopted ESLint and EditorConfig
// locations.
import * as messages from '#cli/policy/messages.ts';
import { policyLayers } from '#cli/policy/problems.ts';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { LOCATION_SPECIFIER } from '#cli/constants/policy/policy.ts';

import type {
    Policy,
    Located,
    PathSegment,
    PolicyProblem,
    EslintAdoption,
    ModuleReference,
    EditorconfigAdoption,
} from '#cli/types/policy/policy.ts';

// The problems a reader finds, or the error it threw, attributed to the policy value being read.
function guarded(location: PathSegment[], read: () => PolicyProblem[]): PolicyProblem[] {
    try {
        return read();
    } catch (error) {
        return [{ path: location, message: String(error) }];
    }
}

// Duplicate scope declarations after case and Unicode normalization.
function duplicateScopeProblems(paths: string[]): PolicyProblem[] {
    const seen = new Set<string>();
    const problems: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const key = path.normalize('NFC').toLowerCase();
        if (seen.has(key))
            problems.push({
                path: ['scope', index, 'path'],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    return problems;
}

// The problem of a base path that exists and is not a directory, after registering it as a mutation target.
function basePathProblem(files: ConfinedRoot, base: string, location: PathSegment[], tool: string): PolicyProblem[] {
    mutationPath(base);
    const observed = files.stat(base);
    if (observed === undefined || observed.isDirectory()) return [];
    return [{ path: location, message: `${tool} basePath is not a directory: ${base}` }];
}

// Every executable module an adopted ESLint entry names: plugins, the parser, and an object processor.
function eslintReferences(entry: EslintAdoption): Located<ModuleReference>[] {
    const plugins = Object.entries(entry.plugins ?? {}).map(([name, reference]) => ({
        value: reference,
        path: ['plugins', name, 'module'],
    }));
    const parser = entry.languageOptions?.parser;
    const parserReference =
        parser === undefined ? [] : [{ value: parser, path: ['languageOptions', 'parser', 'module'] }];
    const transform =
        typeof entry.processor === 'object' ? [{ value: entry.processor, path: ['processor', 'module'] }] : [];
    return [...plugins, ...parserReference, ...transform];
}

// The problem of a module reference that is missing from the repository or points outside it.
function referenceProblem(files: ConfinedRoot, reference: ModuleReference, location: PathSegment[]): PolicyProblem[] {
    const { module } = reference;
    if (module.startsWith('./')) {
        if (files.read(module.slice('./'.length)) !== undefined) return [];
        return [{ path: location, message: `ESLint executable module is missing: ${module}` }];
    }
    if (!LOCATION_SPECIFIER.test(module)) return [];
    return [{ path: location, message: `ESLint executable module must belong to the repository: ${module}` }];
}

// The problems of one adopted ESLint entry: its base paths and its executable modules.
function eslintEntryProblems(files: ConfinedRoot, entry: EslintAdoption, location: PathSegment[]): PolicyProblem[] {
    const ignores = (entry.legacyIgnores ?? []).flatMap((ignore, index) => [
        { value: ignore.basePath, path: ['legacyIgnores', index, 'basePath'] },
        { value: ignore.criteria?.basePath, path: ['legacyIgnores', index, 'criteria', 'basePath'] },
    ]);
    const paths: Located<string | undefined>[] = [
        { value: entry.basePath, path: ['basePath'] },
        { value: entry.legacyCriteria?.basePath, path: ['legacyCriteria', 'basePath'] },
        { value: entry.legacyScope?.basePath, path: ['legacyScope', 'basePath'] },
        ...ignores,
    ];
    const bases = paths.flatMap(({ value, path }) => {
        if (value === undefined || value === '.') return [];
        const at = [...location, ...path];
        return guarded(at, () => basePathProblem(files, value, at, 'ESLint'));
    });
    const references = eslintReferences(entry).flatMap(({ value, path }) => {
        const at = [...location, ...path];
        return guarded(at, () => referenceProblem(files, value, at));
    });
    return [...bases, ...references];
}

/**
 * Validate scope directories and repository-owned ESLint selector and executable paths.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function pathProblems(root: string, policy: Policy): PolicyProblem[] {
    const paths = policy.scopes.map((scope) => scope.path);
    const files = openConfinedRoot(root);
    try {
        const missing = paths.flatMap((path, index) => {
            const location: PathSegment[] = ['scope', index, 'path'];
            return guarded(location, () =>
                files.stat(path)?.isDirectory() === true
                    ? []
                    : [{ path: location, message: messages.scopeMissing(path) }],
            );
        });
        const configuration = policyLayers(policy).flatMap(({ table, path }) => {
            const editorconfig = table.tools?.['editorconfig']?.['adopted'] as EditorconfigAdoption | undefined;
            const eslint = (table.tools?.['eslint']?.['adopted'] ?? []) as EslintAdoption[];
            const directories = (editorconfig?.directories ?? []).flatMap((directory, index) => {
                const location = [...path, 'tools', 'editorconfig', 'adopted', 'directories', index, 'basePath'];
                return guarded(location, () => basePathProblem(files, directory.basePath, location, 'EditorConfig'));
            });
            return [
                ...directories,
                ...eslint.flatMap((entry, index) =>
                    eslintEntryProblems(files, entry, [...path, 'tools', 'eslint', 'adopted', index]),
                ),
            ];
        });
        return [...missing, ...duplicateScopeProblems(paths), ...configuration];
    } finally {
        files.close();
    }
}
