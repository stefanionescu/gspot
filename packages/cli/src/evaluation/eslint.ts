import { z } from 'zod';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { createRequire, isBuiltin } from 'node:module';
import { eslintResponse } from '#cli/evaluation/protocol.ts';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { mutationPath, openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { EslintAdoption, EslintRegistration } from '#cli/policy/schema.ts';
import type { eslintCoverageRequest, eslintCoverageResponse, eslintRequest } from '#cli/evaluation/protocol.ts';

async function registerEslintModule(
    root: string,
    configPath: string,
    name: string,
    references: Map<unknown, EslintRegistration>,
): Promise<void> {
    const resolved = createRequire(configPath).resolve(name);
    const specifier =
        name.startsWith('.') || isAbsolute(name) ? `./${relative(root, resolved).replaceAll('\\', '/')}` : name;
    if (specifier.startsWith('./../'))
        throw new Error(`ESLint conversion cannot register a module outside the repository: ${name}`);
    const imported = (await import(isBuiltin(resolved) ? resolved : pathToFileURL(resolved).href)) as Record<
        string,
        unknown
    >;
    references.set(imported, { module: specifier, export: '*' });
    // Prefer the default export before runtime-specific CommonJS named exports.
    const pending = Object.entries(imported)
        .toSorted(([left], [right]) => Number(left === 'default') - Number(right === 'default'))
        .map(([key, value]) => ({ value, exported: key, members: [] as string[] }));
    for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
        const { value, exported, members } = entry;
        if (value === null || (typeof value !== 'object' && typeof value !== 'function') || references.has(value))
            continue;
        references.set(value, {
            module: specifier,
            export: exported,
            ...(members.length === 0 ? {} : { members }),
        });
        if (typeof value === 'object')
            for (const [member, entry] of Object.entries(value))
                pending.push({ value: entry, exported, members: [...members, member] });
    }
}

function legacyCriteria(root: string, criteria: LegacyEslintCriteria): NonNullable<EslintAdoption['legacyCriteria']> {
    const basePath = relative(root, criteria.basePath).replaceAll('\\', '/') || '.';
    if (basePath !== '.') mutationPath(basePath);
    return {
        basePath,
        patterns: criteria.patterns.map(({ includes, excludes }) => {
            const encode = (matchers: NonNullable<typeof includes>) =>
                matchers.map(
                    (matcher) =>
                        `${matcher.options.matchBase === false ? './' : ''}${matcher.negate ? '!' : ''}${matcher.pattern}`,
                );
            return {
                ...(includes === null ? {} : { includes: encode(includes) }),
                ...(excludes === null ? {} : { excludes: encode(excludes) }),
            };
        }),
    };
}

async function legacyEntries(
    root: string,
    configPath: string,
    references: Map<unknown, EslintRegistration>,
    configPaths: string[],
): Promise<Record<string, unknown>[]> {
    const require = createRequire(createRequire(configPath).resolve('eslint'));
    const api = (await import(pathToFileURL(require.resolve('@eslint/eslintrc')).href)) as LegacyEslintApi;
    const js = (await import(pathToFileURL(require.resolve('@eslint/js')).href)).default as {
        configs: { recommended: Record<string, unknown>; all: Record<string, unknown> };
    };
    const factory = new api.Legacy.ConfigArrayFactory({
        cwd: root,
        resolvePluginsRelativeTo: root,
        getEslintRecommendedConfig: () => js.configs.recommended,
        getEslintAllConfig: () => js.configs.all,
    });
    const files = openConfinedRoot(root);
    try {
        files.read('.eslintignore');
        files.read('package.json');
    } finally {
        files.close();
    }
    const directories = [...new Set(['.', ...configPaths.map((path) => dirname(path))])].sort(
        (left, right) => left.length - right.length,
    );
    const literalDirectory = (directory: string): string =>
        directory.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
    const configurations = new Map(
        directories.map((directory) => [directory, factory.loadInDirectory(resolve(root, directory))]),
    );
    const result: Record<string, unknown>[] = [];
    for (const directory of directories) {
        let source: LegacyEslintEntry[] = [];
        for (const ancestor of directories) {
            if (ancestor !== '.' && ancestor !== directory && !directory.startsWith(`${ancestor}/`)) continue;
            const entries = configurations.get(ancestor)!;
            if (entries.some((entry) => entry['root'] === true)) source = [];
            source.push(...entries);
        }
        source.push(...factory.loadDefaultESLintIgnore());
        const scope = {
            basePath: '.',
            patterns: [
                {
                    includes: [directory === '.' ? '**/*' : `${literalDirectory(directory)}/**/*`],
                    excludes: directories
                        .filter(
                            (child) =>
                                child !== directory &&
                                child !== '.' &&
                                (directory === '.' || child.startsWith(`${directory}/`)),
                        )
                        .map((child) => `${literalDirectory(child)}/**/*`),
                },
            ],
        };
        const compat = new api.FlatCompat({
            baseDirectory: root,
            resolvePluginsRelativeTo: root,
            recommendedConfig: js.configs.recommended,
            allConfig: js.configs.all,
        });
        const adopted: Record<string, unknown>[] = [{ languageOptions: { ecmaVersion: 5, sourceType: 'script' } }];
        const ignores: NonNullable<EslintAdoption['legacyIgnores']> = [
            { basePath: '.', patterns: api.Legacy.IgnorePattern.DefaultPatterns, loose: false },
        ];
        const plugins = Object.assign({}, ...source.map((entry) => entry.plugins ?? {})) as NonNullable<
            (typeof source)[number]['plugins']
        >;
        for (const entry of source) {
            const criteria = entry.criteria === null ? undefined : legacyCriteria(root, entry.criteria);
            if (entry.ignorePattern !== undefined) {
                const basePath = relative(root, entry.ignorePattern.basePath).replaceAll('\\', '/') || '.';
                if (basePath !== '.') mutationPath(basePath);
                ignores.push({ ...entry.ignorePattern, basePath, ...(criteria === undefined ? {} : { criteria }) });
            }
            if (entry.type !== 'config') continue;
            const config: Record<string, unknown> = {};
            for (const key of [
                'env',
                'globals',
                'noInlineConfig',
                'parserOptions',
                'reportUnusedDisableDirectives',
                'rules',
                'settings',
                'processor',
            ])
                if (entry[key] !== undefined) config[key] = entry[key];
            if (entry.parser !== undefined) {
                if (entry.parser.error != null) throw entry.parser.error;
                config['parser'] = entry.parser.filePath;
                await registerEslintModule(
                    root,
                    configPath,
                    entry.parser.id.startsWith('.') ? entry.parser.filePath : entry.parser.id,
                    references,
                );
            }
            const activePlugins = entry['env'] === undefined ? entry.plugins : plugins;
            if (activePlugins !== undefined) {
                config['plugins'] = Object.keys(activePlugins);
                for (const dependency of Object.values(activePlugins)) {
                    if (dependency.error != null) throw dependency.error;
                    await registerEslintModule(
                        root,
                        configPath,
                        api.Legacy.naming.normalizePackageName(dependency.id, 'eslint-plugin'),
                        references,
                    );
                }
            }
            for (const translated of compat.config(config))
                adopted.push({ ...translated, ...(criteria === undefined ? {} : { legacyCriteria: criteria }) });
        }
        adopted.unshift({ legacyIgnores: ignores });
        result.push(...adopted.map((entry) => ({ ...entry, legacyScope: scope })));
    }
    return result;
}

/**
 * Import native ESLint configuration while preserving selectors and repository-owned executable modules.
 * @param request
 */
export async function evaluateEslint(request: z.infer<typeof eslintRequest>): Promise<z.infer<typeof eslintResponse>> {
    if (!request.flat && request.from === undefined)
        throw new Error('Legacy ESLint adoption requires a configuration path.');
    const require = createRequire(join(request.root, 'package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof import('eslint');
    const Constructor = await module.loadESLint({ useFlatConfig: request.flat });
    const eslint = new Constructor({
        cwd: request.root,
        ...(!request.flat || request.from === undefined
            ? {}
            : { overrideConfigFile: join(request.root, request.from) }),
    });
    const configPath =
        request.from === undefined
            ? await (eslint as import('eslint').ESLint).findConfigFile()
            : join(request.root, request.from);
    if (configPath === undefined) throw new Error('ESLint conversion could not find the active configuration.');
    const files = openConfinedRoot(request.root);
    for (const path of request.configs ?? []) {
        if (files.read(path) === undefined) throw new Error(`The observed ESLint configuration is missing: ${path}`);
    }
    const configuration = files.read(relative(request.root, configPath).replaceAll('\\', '/'));
    files.close();
    if (configuration === undefined) throw new Error('The observed ESLint configuration is missing. Retry adoption.');
    const references = new Map<unknown, EslintRegistration>();
    let entries: unknown[];
    if (request.flat) {
        const syntax = ts.createSourceFile(
            configPath,
            configuration.bytes.toString('utf8'),
            ts.ScriptTarget.Latest,
            true,
        );
        const imports = new Set<string>();
        const collectImport = (expression: ts.Expression): void => {
            if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression)) {
                collectImport(expression.expression);
                return;
            }
            if (ts.isPropertyAccessExpression(expression)) {
                collectImport(expression.expression);
                return;
            }
            if (!ts.isCallExpression(expression)) return;
            const [specifier] = expression.arguments;
            if (
                expression.arguments.length === 1 &&
                specifier !== undefined &&
                ts.isStringLiteral(specifier) &&
                (expression.expression.kind === ts.SyntaxKind.ImportKeyword ||
                    (ts.isIdentifier(expression.expression) && expression.expression.text === 'require'))
            )
                imports.add(specifier.text);
        };
        for (const statement of syntax.statements) {
            if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
                imports.add(statement.moduleSpecifier.text);
            else if (ts.isVariableStatement(statement)) {
                for (const declaration of statement.declarationList.declarations)
                    if (declaration.initializer !== undefined) collectImport(declaration.initializer);
            } else if (ts.isExportAssignment(statement)) collectImport(statement.expression);
            else if (
                ts.isExpressionStatement(statement) &&
                ts.isBinaryExpression(statement.expression) &&
                statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
            )
                collectImport(statement.expression.right);
        }
        for (const name of imports) await registerEslintModule(request.root, configPath, name, references);
        const loaded = (await import(pathToFileURL(configPath).href)) as { default: unknown };
        if (!Array.isArray(loaded.default)) throw new Error('ESLint conversion requires a flat configuration array.');
        entries = loaded.default;
    } else
        entries = await legacyEntries(
            request.root,
            configPath,
            references,
            request.configs ?? [relative(request.root, configPath)],
        );
    const adopted = [];
    for (const [index, raw] of entries.entries()) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
            throw new Error(`ESLint configuration ${index} is not a flat configuration object.`);
        const entry = { ...raw } as Record<string, unknown>;
        if (entry['processor'] !== undefined && typeof entry['processor'] !== 'string') {
            const reference = references.get(entry['processor']);
            if (reference === undefined)
                throw new Error(`ESLint configuration ${index}: processor has no imported module owner.`);
            entry['processor'] = reference;
        }
        if (request.flat && (entry['basePath'] !== undefined || dirname(configPath) !== request.root)) {
            if (entry['basePath'] !== undefined && typeof entry['basePath'] !== 'string')
                throw new Error(`ESLint configuration ${index}: basePath must be a directory path.`);
            const base = relative(request.root, resolve(dirname(configPath), entry['basePath'] ?? '.')).replaceAll(
                '\\',
                '/',
            );
            if (base === '') delete entry['basePath'];
            else {
                mutationPath(base);
                const files = openConfinedRoot(request.root);
                try {
                    const directory = files.stat(base);
                    if (directory !== undefined && !directory.isDirectory())
                        throw new Error(`ESLint configuration ${index}: basePath is not a directory.`);
                } finally {
                    files.close();
                }
                entry['basePath'] = base;
            }
        }
        const plugins = entry['plugins'] as Record<string, unknown> | undefined;
        if (plugins !== undefined) {
            entry['plugins'] = Object.fromEntries(
                Object.entries(plugins).map(([name, value]) => {
                    const reference = references.get(value);
                    if (reference === undefined)
                        throw new Error(
                            `ESLint plugin ${name} has no imported module owner. Export the custom plugin from repository-owned code and import it before adopting configuration.`,
                        );
                    return [name, reference];
                }),
            );
        }
        const language = entry['languageOptions'] as Record<string, unknown> | undefined;
        if (language?.['parser'] !== undefined) {
            const reference = references.get(language['parser']);
            if (reference === undefined)
                throw new Error(`ESLint configuration ${index}: parser has no imported module owner.`);
            entry['languageOptions'] = { ...language, parser: reference };
        }
        if (!z.json().safeParse(entry).success)
            throw new Error(
                `ESLint configuration ${index} contains data TOML cannot represent outside a registered plugin, parser, or processor.`,
            );
        const serialized = JSON.stringify(entry, (_key, value: unknown) => {
            if (
                value === null ||
                value === undefined ||
                (typeof value === 'number' && !Number.isFinite(value)) ||
                typeof value === 'function' ||
                typeof value === 'symbol' ||
                typeof value === 'bigint' ||
                value instanceof RegExp
            )
                throw new Error(
                    `ESLint configuration ${index} contains data TOML cannot represent outside a registered plugin, parser, or processor.`,
                );
            return value;
        });
        adopted.push(JSON.parse(serialized) as Record<string, unknown>);
    }
    const result = eslintResponse.parse({ adopted });
    for (const path of request.paths) await eslint.calculateConfigForFile(join(request.root, path));
    return result;
}
/**
 * Resolve every selected file with one native ESLint instance in an isolated configuration process.
 * @param request
 */
export async function evaluateRuleCoverage(
    request: z.infer<typeof eslintCoverageRequest>,
): Promise<z.infer<typeof eslintCoverageResponse>> {
    if (openConfinedRoot(request.root).read('.gspot/config/eslint.config.mjs') === undefined)
        throw new Error('The generated ESLint configuration is missing. Run: gspot apply');
    const require = createRequire(join(request.root, '.gspot/package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof import('eslint');
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
            return level === 1 || level === 2 || level === 'warn' || level === 'error' ? [name] : [];
        });
    }
    return result;
}

export type LegacyEslintMatcher = {
    pattern: string;
    negate: boolean;
    options: { matchBase?: boolean };
};

export type LegacyEslintCriteria = {
    basePath: string;
    patterns: { includes: LegacyEslintMatcher[] | null; excludes: LegacyEslintMatcher[] | null }[];
};

export type LegacyEslintDependency = {
    id: string;
    filePath: string;
    definition: unknown;
    original?: unknown;
    error?: Error | null;
};

export type LegacyEslintEntry = {
    type: string;
    name: string;
    criteria: LegacyEslintCriteria | null;
    ignorePattern?: { basePath: string; patterns: string[]; loose: boolean };
    parser?: LegacyEslintDependency;
    plugins?: Record<string, LegacyEslintDependency>;
    [key: string]: unknown;
};

export type LegacyEslintApi = {
    Legacy: {
        ConfigArrayFactory: new (options: Record<string, unknown>) => {
            loadFile(path: string): LegacyEslintEntry[];
            loadInDirectory(path: string): LegacyEslintEntry[];
            loadDefaultESLintIgnore(): LegacyEslintEntry[];
        };
        IgnorePattern: { DefaultPatterns: string[] };
        naming: { normalizePackageName(name: string, prefix: string): string };
    };
    FlatCompat: new (options: Record<string, unknown>) => {
        config(configuration: Record<string, unknown>): Record<string, unknown>[];
    };
};
