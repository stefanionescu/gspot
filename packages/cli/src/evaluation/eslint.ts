import { z } from 'zod';
import type * as Eslint from 'eslint';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import { ACTIVE_LEVELS } from '#cli/constants/evaluation.ts';
import { dirname, join, relative, resolve } from 'node:path';
import { eslintResponse } from '#cli/evaluation/protocol.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { legacyEntries } from '#cli/evaluation/eslint-legacy.ts';
import type { EslintRegistration } from '#cli/types/policy/policy.ts';
import type { Adoption, EslintRequest } from '#cli/types/evaluation.ts';
import { importedModules, registerEslintModule } from '#cli/evaluation/eslint-modules.ts';
import type { eslintCoverageRequest, eslintCoverageResponse } from '#cli/evaluation/protocol.ts';

// The values TOML cannot hold, which a configuration may carry only through a registered module.
function isUnrepresentable(value: unknown): boolean {
    if (value === null || value === undefined || value instanceof RegExp) return true;
    if (typeof value === 'number') return !Number.isFinite(value);
    return typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint';
}

// The configuration file ESLint reads for the repository, or the one the request names.
async function activeConfigPath(request: EslintRequest, eslint: Eslint.ESLint): Promise<string> {
    if (request.from !== undefined) return join(request.root, request.from);
    const found = await eslint.findConfigFile();
    if (found === undefined) throw new Error('ESLint conversion could not find the active configuration.');
    return found;
}

// The observed configuration's bytes, after every observed file is confirmed present.
function readConfiguration(request: EslintRequest, configPath: string): string {
    const files = openConfinedRoot(request.root);
    try {
        for (const path of request.configs ?? []) {
            if (files.read(path) === undefined)
                throw new Error(`The observed ESLint configuration is missing: ${path}`);
        }
        const configuration = files.read(relative(request.root, configPath).replaceAll('\\', '/'));
        if (configuration === undefined)
            throw new Error('The observed ESLint configuration is missing. Retry adoption.');
        return configuration.bytes.toString('utf8');
    } finally {
        files.close();
    }
}

// The entries of a flat configuration, with every module it imports registered first.
async function flatEntries(adoption: Adoption, text: string): Promise<unknown[]> {
    const { request, configPath, references } = adoption;
    for (const name of importedModules(configPath, text))
        await registerEslintModule(request.root, configPath, name, references);
    const loaded = (await import(pathToFileURL(configPath).href)) as { default: unknown };
    const entries: unknown = loaded.default;
    if (!Array.isArray(entries)) throw new Error('ESLint conversion requires a flat configuration array.');
    return entries as unknown[];
}

// Replaces a processor value with the registration of the module that exported it.
function resolveProcessor(adoption: Adoption, entry: Record<string, unknown>, index: number): void {
    if (entry['processor'] === undefined || typeof entry['processor'] === 'string') return;
    const reference = adoption.references.get(entry['processor']);
    if (reference === undefined)
        throw new Error(`ESLint configuration ${String(index)}: processor has no imported module owner.`);
    entry['processor'] = reference;
}

// Refuses a base path that exists and is not a directory.
function assertDirectory(root: string, base: string, index: number): void {
    mutationPath(base);
    const files = openConfinedRoot(root);
    try {
        const directory = files.stat(base);
        if (directory !== undefined && !directory.isDirectory())
            throw new Error(`ESLint configuration ${String(index)}: basePath is not a directory.`);
    } finally {
        files.close();
    }
}

// The base path of an entry relative to the repository root, or undefined when the entry needs none.
function relativeBasePath(adoption: Adoption, entry: Record<string, unknown>, index: number): string | undefined {
    const { request, configPath } = adoption;
    if (!request.flat || (entry['basePath'] === undefined && dirname(configPath) === request.root)) return undefined;
    if (entry['basePath'] !== undefined && typeof entry['basePath'] !== 'string')
        throw new Error(`ESLint configuration ${String(index)}: basePath must be a directory path.`);
    return relative(request.root, resolve(dirname(configPath), entry['basePath'] ?? '.')).replaceAll('\\', '/');
}

// Rewrites a base path relative to the repository root, checking that it names a directory.
function resolveBasePath(adoption: Adoption, entry: Record<string, unknown>, index: number): void {
    const base = relativeBasePath(adoption, entry, index);
    if (base === undefined) return;
    if (base === '') {
        delete entry['basePath'];
        return;
    }
    assertDirectory(adoption.request.root, base, index);
    entry['basePath'] = base;
}

// Replaces each plugin value with the registration of the module that exported it.
function resolvePlugins(adoption: Adoption, entry: Record<string, unknown>): void {
    const plugins = entry['plugins'] as Record<string, unknown> | undefined;
    if (plugins === undefined) return;
    entry['plugins'] = Object.fromEntries(
        Object.entries(plugins).map(([name, value]) => {
            const reference = adoption.references.get(value);
            if (reference === undefined)
                throw new Error(
                    `ESLint plugin ${name} has no imported module owner. Export the custom plugin from repository-owned code and import it before adopting configuration.`,
                );
            return [name, reference];
        }),
    );
}

// Replaces a parser value with the registration of the module that exported it.
function resolveParser(adoption: Adoption, entry: Record<string, unknown>, index: number): void {
    const language = entry['languageOptions'] as Record<string, unknown> | undefined;
    if (language?.['parser'] === undefined) return;
    const reference = adoption.references.get(language['parser']);
    if (reference === undefined)
        throw new Error(`ESLint configuration ${String(index)}: parser has no imported module owner.`);
    entry['languageOptions'] = { ...language, parser: reference };
}

// The entry as plain data, refused when it still carries a value TOML cannot hold.
function serializable(entry: Record<string, unknown>, index: number): Record<string, unknown> {
    const message = `ESLint configuration ${String(index)} contains data TOML cannot represent outside a registered plugin, parser, or processor.`;
    if (!z.json().safeParse(entry).success) throw new Error(message);
    const serialized = JSON.stringify(entry, (_key, value: unknown) => {
        if (isUnrepresentable(value)) throw new Error(message);
        return value;
    });
    return JSON.parse(serialized) as Record<string, unknown>;
}

// One configuration entry with its module-valued fields named by their owners.
function adoptEntry(adoption: Adoption, raw: unknown, index: number): Record<string, unknown> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error(`ESLint configuration ${String(index)} is not a flat configuration object.`);
    const entry = { ...raw } as Record<string, unknown>;
    resolveProcessor(adoption, entry, index);
    resolveBasePath(adoption, entry, index);
    resolvePlugins(adoption, entry);
    resolveParser(adoption, entry, index);
    return serializable(entry, index);
}

/**
 * Import native ESLint configuration while preserving selectors and repository-owned executable modules.
 * @param request the repository root, the configuration to read, and whether it is a flat configuration
 * @returns the rules, selectors, and module registrations the configuration holds
 */
export async function evaluateEslint(request: EslintRequest): Promise<z.infer<typeof eslintResponse>> {
    if (!request.flat && request.from === undefined)
        throw new Error('Legacy ESLint adoption requires a configuration path.');
    const require = createRequire(join(request.root, 'package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof Eslint;
    const Constructor = await module.loadESLint({ useFlatConfig: request.flat });
    const eslint = new Constructor({
        cwd: request.root,
        ...(!request.flat || request.from === undefined
            ? {}
            : { overrideConfigFile: join(request.root, request.from) }),
    });
    const configPath = await activeConfigPath(request, eslint as Eslint.ESLint);
    const text = readConfiguration(request, configPath);
    const adoption: Adoption = { request, configPath, references: new Map<unknown, EslintRegistration>() };
    const entries = request.flat
        ? await flatEntries(adoption, text)
        : await legacyEntries(
              request.root,
              configPath,
              adoption.references,
              request.configs ?? [relative(request.root, configPath)],
          );
    const adopted = entries.map((raw, index) => adoptEntry(adoption, raw, index));
    const result = eslintResponse.parse({ adopted });
    for (const path of request.paths) await eslint.calculateConfigForFile(join(request.root, path));
    return result;
}

/**
 * Resolve every selected file with one native ESLint instance in an isolated configuration process.
 * @param request the repository root, the configuration, and the files whose rules to resolve
 * @returns the rules in force for each file
 */
export async function evaluateRuleCoverage(
    request: z.infer<typeof eslintCoverageRequest>,
): Promise<z.infer<typeof eslintCoverageResponse>> {
    if (openConfinedRoot(request.root).read('.gspot/config/eslint.config.mjs') === undefined)
        throw new Error('The generated ESLint configuration is missing. Run: gspot apply');
    const require = createRequire(join(request.root, '.gspot/package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof Eslint;
    const Constructor = await module.loadESLint({ useFlatConfig: true });
    const eslint = new Constructor({
        cwd: request.root,
        overrideConfigFile: join(request.root, '.gspot/config/eslint.config.mjs'),
    });
    const result: Record<string, string[]> = {};
    for (const path of request.paths) {
        const config = (await eslint.calculateConfigForFile(path)) as { rules?: Record<string, unknown> } | undefined;
        if (config === undefined) throw new Error(`ESLint did not resolve a configuration for ${path}.`);
        result[path] = Object.entries(config.rules ?? {}).flatMap(([name, entry]) => {
            const level = Array.isArray(entry) ? (entry[0] as unknown) : entry;
            return ACTIVE_LEVELS.has(level) ? [name] : [];
        });
    }
    return result;
}
