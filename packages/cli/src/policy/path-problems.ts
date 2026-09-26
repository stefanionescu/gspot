// The paths a policy names that must exist in the repository: scope directories and adopted ESLint and EditorConfig
// locations.
import * as messages from '#cli/policy/messages.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { policyLayers } from '#cli/policy/problems.ts';
import type { PathSegment, PolicyProblem } from '#cli/policy/problems.ts';
import type { EditorconfigAdoption, EslintAdoption } from '#cli/policy/schema.ts';
import { type ConfinedRoot, mutationPath, openConfinedRoot } from '#cli/platform/filesystem.ts';

type Located<T> = { value: T; path: PathSegment[] };
type ModuleReference = { module: string };

// A module specifier that names a location on disk rather than a package, unless it is repository-relative.
const LOCATION_SPECIFIER = /^(?:\.|\/|\\|[A-Za-z]:)/u;

// The problems a reader finds, or the error it threw, attributed to the policy value being read.
function guarded(location: PathSegment[], read: () => PolicyProblem[]): PolicyProblem[] {
    try {
        return read();
    } catch (error) {
        return [{ path: location, message: String(error) }];
    }
}

// The problem of a scope path that is not a directory in the repository.
function scopeProblems(files: ConfinedRoot, index: number, path: string): PolicyProblem[] {
    const location: PathSegment[] = ['scope', index, 'path'];
    return guarded(location, () =>
        files.stat(path)?.isDirectory() === true ? [] : [{ path: location, message: messages.scopeMissing(path) }],
    );
}

// The problems of scope paths declared twice, compared without regard to case or Unicode form.
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

// The problems of the EditorConfig directories a layer adopted.
function editorconfigProblems(files: ConfinedRoot, scope: Partial<Policy>, path: PathSegment[]): PolicyProblem[] {
    const adopted = scope.tools?.['editorconfig']?.['adopted'] as EditorconfigAdoption | undefined;
    return (adopted?.directories ?? []).flatMap((directory, index) => {
        const location = [...path, 'tools', 'editorconfig', 'adopted', 'directories', index, 'basePath'];
        return guarded(location, () => basePathProblem(files, directory.basePath, location, 'EditorConfig'));
    });
}

// Every base path an adopted ESLint entry carries, with where each one sits in the policy.
function eslintBasePaths(entry: EslintAdoption): Located<string | undefined>[] {
    const ignores = (entry.legacyIgnores ?? []).flatMap((ignore, index) => [
        { value: ignore.basePath, path: ['legacyIgnores', index, 'basePath'] },
        { value: ignore.criteria?.basePath, path: ['legacyIgnores', index, 'criteria', 'basePath'] },
    ]);
    return [
        { value: entry.basePath, path: ['basePath'] },
        { value: entry.legacyCriteria?.basePath, path: ['legacyCriteria', 'basePath'] },
        { value: entry.legacyScope?.basePath, path: ['legacyScope', 'basePath'] },
        ...ignores,
    ];
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
    const processor =
        typeof entry.processor === 'object' ? [{ value: entry.processor, path: ['processor', 'module'] }] : [];
    return [...plugins, ...parserReference, ...processor];
}

// The problem of a module reference that is missing from the repository or points outside it.
function referenceProblem(files: ConfinedRoot, reference: ModuleReference, location: PathSegment[]): PolicyProblem[] {
    const { module } = reference;
    if (module.startsWith('./')) {
        if (files.read(module.slice(2)) !== undefined) return [];
        return [{ path: location, message: `ESLint executable module is missing: ${module}` }];
    }
    if (!LOCATION_SPECIFIER.test(module)) return [];
    return [{ path: location, message: `ESLint executable module must belong to the repository: ${module}` }];
}

// The problems of one adopted ESLint entry: its base paths and its executable modules.
function eslintEntryProblems(files: ConfinedRoot, entry: EslintAdoption, location: PathSegment[]): PolicyProblem[] {
    const bases = eslintBasePaths(entry).flatMap(({ value, path }) => {
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

// The problems of the ESLint configuration a layer adopted.
function eslintProblems(files: ConfinedRoot, scope: Partial<Policy>, path: PathSegment[]): PolicyProblem[] {
    const adopted = (scope.tools?.['eslint']?.['adopted'] ?? []) as EslintAdoption[];
    return adopted.flatMap((entry, index) =>
        eslintEntryProblems(files, entry, [...path, 'tools', 'eslint', 'adopted', index]),
    );
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
        const missing = paths.flatMap((path, index) => scopeProblems(files, index, path));
        const configuration = policyLayers(policy).flatMap(({ scope, path }) => [
            ...editorconfigProblems(files, scope, path),
            ...eslintProblems(files, scope, path),
        ]);
        return [...missing, ...duplicateScopeProblems(paths), ...configuration];
    } finally {
        files.close();
    }
}
