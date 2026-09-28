// Read eslintrc configuration through the ESLint compatibility layer and translate it to flat entries.
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { CONFIG_KEYS } from '#cli/constants/evaluation.ts';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { EslintRegistration } from '#cli/types/policy/policy.ts';
import { registerEslintModule } from '#cli/evaluation/eslint-modules.ts';

import type {
    Criteria,
    Ignores,
    EslintrcTranslation,
    EslintrcApi,
    EslintrcEntry,
    EslintrcMatcher,
    Plugins,
    Translation,
} from '#cli/types/evaluation.ts';

// A directory name with every glob character escaped, for a files pattern that names it literally.
function literalDirectory(directory: string): string {
    return directory.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
}

// The repository-relative base path of a eslintrc pattern, registered as a mutation target when it names a folder.
function relativeBase(root: string, basePath: string): string {
    const relativePath = relative(root, basePath).replaceAll('\\', '/') || '.';
    if (relativePath !== '.') mutationPath(relativePath);
    return relativePath;
}

// The text of each eslintrc matcher, with its negation and whether it matched against the base kept.
function encodeMatchers(matchers: EslintrcMatcher[]): string[] {
    return matchers.map((matcher) => {
        const base = matcher.options.matchBase === false ? './' : '';
        const negation = matcher.negate ? '!' : '';
        return `${base}${negation}${matcher.pattern}`;
    });
}

// The compatibility layer from the ESLint installation in the repository.
async function eslintrcTranslation(root: string, configPath: string): Promise<EslintrcTranslation> {
    const require = createRequire(createRequire(configPath).resolve('eslint'));
    const api = (await import(pathToFileURL(require.resolve('@eslint/eslintrc')).href)) as EslintrcApi;
    const js = (
        (await import(pathToFileURL(require.resolve('@eslint/js')).href)) as {
            default: { configs: { recommended: Record<string, unknown>; all: Record<string, unknown> } };
        }
    ).default;
    const factory = new api.Legacy.ConfigArrayFactory({
        cwd: root,
        resolvePluginsRelativeTo: root,
        getEslintRecommendedConfig: () => js.configs.recommended,
        getEslintAllConfig: () => js.configs.all,
    });
    const compat = new api.FlatCompat({
        baseDirectory: root,
        resolvePluginsRelativeTo: root,
        recommendedConfig: js.configs.recommended,
        allConfig: js.configs.all,
    });
    return { api, factory, compat };
}

// The eslintrc entries that apply in a directory: every ancestor's, restarting at a root configuration.
function directorySources(
    directory: string,
    directories: string[],
    configurations: Map<string, EslintrcEntry[]>,
): EslintrcEntry[] {
    let source: EslintrcEntry[] = [];
    for (const ancestor of directories) {
        if (ancestor !== '.' && ancestor !== directory && !directory.startsWith(`${ancestor}/`)) continue;
        const entries = configurations.get(ancestor) ?? [];
        if (entries.some((entry) => entry['root'] === true)) source = [];
        source.push(...entries);
    }
    return source;
}

// The files a directory's configuration governs: its tree, less the trees of configured directories inside it.
function directoryScope(directory: string, directories: string[]): Record<string, unknown> {
    const excludes = directories
        .filter(
            (child) => child !== directory && child !== '.' && (directory === '.' || child.startsWith(`${directory}/`)),
        )
        .map((child) => `${literalDirectory(child)}/**/*`);
    const includes = [directory === '.' ? '**/*' : `${literalDirectory(directory)}/**/*`];
    return { basePath: '.', patterns: [{ includes, excludes }] };
}

// Registers the parser a eslintrc entry names and records its path.
async function translateParser(
    translation: Translation,
    entry: EslintrcEntry,
    config: Record<string, unknown>,
): Promise<void> {
    const { parser } = entry;
    if (parser === undefined) return;
    if (parser.error) throw parser.error;
    config['parser'] = parser.filePath;
    const name = parser.id.startsWith('.') ? parser.filePath : parser.id;
    await registerEslintModule(translation.root, translation.configPath, name, translation.references);
}

// Registers the plugins a eslintrc entry activates and records their names.
async function translatePlugins(
    translation: Translation,
    plugins: Plugins | undefined,
    config: Record<string, unknown>,
): Promise<void> {
    if (plugins === undefined) return;
    config['plugins'] = Object.keys(plugins);
    for (const dependency of Object.values(plugins)) {
        if (dependency.error) throw dependency.error;
        const name = translation.eslintrc.api.Legacy.naming.normalizePackageName(dependency.id, 'eslint-plugin');
        await registerEslintModule(translation.root, translation.configPath, name, translation.references);
    }
}

// The flat entries one eslintrc configuration entry translates to, each carrying its file criteria.
async function translateEntry(
    translation: Translation,
    entry: EslintrcEntry,
    plugins: Plugins,
    criteria: Criteria | undefined,
): Promise<Record<string, unknown>[]> {
    const config: Record<string, unknown> = {};
    for (const key of CONFIG_KEYS) if (entry[key] !== undefined) config[key] = entry[key];
    await translateParser(translation, entry, config);
    await translatePlugins(translation, entry['env'] === undefined ? entry.plugins : plugins, config);
    return translation.eslintrc.compat
        .config(config)
        .map((translated) => ({ ...translated, ...(criteria === undefined ? {} : { legacyCriteria: criteria }) }));
}

// Records the ignore pattern a eslintrc entry carries, scoped to the entry's criteria.
function collectIgnore(root: string, entry: EslintrcEntry, criteria: Criteria | undefined, ignores: Ignores): void {
    if (entry.ignorePattern === undefined) return;
    const basePath = relativeBase(root, entry.ignorePattern.basePath);
    ignores.push({ ...entry.ignorePattern, basePath, ...(criteria === undefined ? {} : { criteria }) });
}

// The flat entries of one configured directory: its ignores first, then each translated entry, all scoped to it.
async function directoryEntries(
    translation: Translation,
    directory: string,
    directories: string[],
    configurations: Map<string, EslintrcEntry[]>,
): Promise<Record<string, unknown>[]> {
    const { root, eslintrc } = translation;
    const source = [
        ...directorySources(directory, directories, configurations),
        ...eslintrc.factory.loadDefaultESLintIgnore(),
    ];
    const adopted: Record<string, unknown>[] = [{ languageOptions: { ecmaVersion: 5, sourceType: 'script' } }];
    const ignores: Ignores = [
        { basePath: '.', patterns: eslintrc.api.Legacy.IgnorePattern.DefaultPatterns, loose: false },
    ];
    const plugins = Object.assign({}, ...source.map((entry) => entry.plugins ?? {})) as Plugins;
    for (const entry of source) {
        const criteria =
            entry.criteria === null
                ? undefined
                : {
                      basePath: relativeBase(root, entry.criteria.basePath),
                      patterns: entry.criteria.patterns.map(({ includes, excludes }) => ({
                          ...(includes === null ? {} : { includes: encodeMatchers(includes) }),
                          ...(excludes === null ? {} : { excludes: encodeMatchers(excludes) }),
                      })),
                  };
        collectIgnore(root, entry, criteria, ignores);
        if (entry.type === 'config') adopted.push(...(await translateEntry(translation, entry, plugins, criteria)));
    }
    const scope = directoryScope(directory, directories);
    return [{ legacyIgnores: ignores }, ...adopted].map((entry) => ({ ...entry, legacyScope: scope }));
}

/**
 * The flat entries an eslintrc configuration tree translates to, one group per configured directory.
 * @param root the repository root.
 * @param configPath the configuration the repository's ESLint is resolved from.
 * @param references the module registrations, extended here.
 * @param configPaths every observed eslintrc configuration file.
 * @returns the entries, each carrying the scope and criteria the eslintrc files gave it.
 */
export async function eslintrcEntries(
    root: string,
    configPath: string,
    references: Map<unknown, EslintRegistration>,
    configPaths: string[],
): Promise<Record<string, unknown>[]> {
    const eslintrc = await eslintrcTranslation(root, configPath);
    const files = openConfinedRoot(root);
    try {
        files.read('.eslintignore');
        files.read('package.json');
    } finally {
        files.close();
    }
    const directories = [...new Set(['.', ...configPaths.map((path) => dirname(path))])].toSorted(
        (left, right) => left.length - right.length,
    );
    const configurations = new Map(
        directories.map((directory) => [directory, eslintrc.factory.loadInDirectory(resolve(root, directory))]),
    );
    const translation: Translation = { root, configPath, references, eslintrc };
    const result: Record<string, unknown>[] = [];
    for (const directory of directories)
        result.push(...(await directoryEntries(translation, directory, directories, configurations)));
    return result;
}
