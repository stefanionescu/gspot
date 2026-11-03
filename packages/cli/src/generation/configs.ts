import { readFileSync } from 'node:fs';
import { remember } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { Config } from '#cli/types/repository.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { requireTypescript } from '#cli/system/typescript.ts';
import { listOwnedConfigs } from '#cli/generation/selection.ts';
import type { ConfigGeneration } from '#cli/types/engine/tool-runs.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import { IMPORT_CYCLES_CONFIG } from '#cli/config/configurations/eslint.ts';
import { TS_EXTENSION, CONFIG_SCOPES_FOLDER } from '#cli/config/generation.ts';
import { buildLycheeFile } from '#cli/configurations/general/docs/generate.ts';
import { buildKnipFile } from '#cli/configurations/language/javascript/knip.ts';
import { buildSqlfluffFile } from '#cli/configurations/language/sql/generate.ts';
import { buildTyposFile } from '#cli/configurations/general/spelling/generate.ts';
import { buildStylelintFile } from '#cli/configurations/language/css/generate.ts';
import { buildBiomeFile } from '#cli/configurations/language/javascript/biome.ts';
import { listPointerPaths, buildPointerFiles } from '#cli/generation/pointers.ts';
import { buildJscpdFile } from '#cli/configurations/general/structure/generate.ts';
import { buildCoverageFile } from '#cli/configurations/testing/pytest/generate.ts';
import { buildSquawkFile } from '#cli/configurations/database/postgres/generate.ts';
import { buildShellcheckFile } from '#cli/configurations/language/bash/generate.ts';
import { buildGixyFile } from '#cli/configurations/infrastructure/nginx/generate.ts';
import { buildPeripheryFile } from '#cli/configurations/language/swift/periphery.ts';
import { buildSwiftlintFile } from '#cli/configurations/language/swift/swiftlint.ts';
import { isPointerInherited, buildIgnoreSections } from '#cli/generation/ignores.ts';
import { buildCommitlintFile } from '#cli/configurations/general/commits/generate.ts';
import { buildHtmlValidateFile } from '#cli/configurations/language/html/generate.ts';
import { buildJsconfigFile } from '#cli/configurations/language/javascript/jsconfig.ts';
import type { OwnedConfig, PlannedConfig } from '#cli/types/configurations/language.ts';
import { buildSwiftformatFile } from '#cli/configurations/language/swift/swiftformat.ts';
import { buildMarkdownlintFile } from '#cli/configurations/language/markdown/generate.ts';
import { buildPurgecssSafelistFile } from '#cli/configurations/framework/site/generate.ts';
import { buildOsvScannerFile } from '#cli/configurations/general/dependencies/generate.ts';
import { buildSpectralFile } from '#cli/configurations/infrastructure/openapi/generate.ts';
import { buildEslintFile } from '#cli/configurations/language/javascript/eslint/config.ts';
import { buildAnsibleLintFile } from '#cli/configurations/infrastructure/ansible/generate.ts';
import type { BuiltConfig, OwnedSourceFile, ConfigBuildState } from '#cli/types/generation.ts';
import { buildV8rFile, buildTaploFile } from '#cli/configurations/general/data-files/generate.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/configurations/language/python/generate.ts';
import { buildTrivyFile, buildHadolintFile } from '#cli/configurations/infrastructure/docker/generate.ts';

import {
    VOCAB_LINE,
    TOKEN_IGNORES,
    MIN_ALERT_LINE,
    VALE_STYLES_PATH,
    ALL_FILES_SECTION,
} from '#cli/config/tools/vale.ts';
import {
    buildPrettierFile,
    buildEditorconfigFile,
    buildPrettierignoreFile,
} from '#cli/configurations/general/format/generate.ts';
import {
    buildTermsStyle,
    buildValeIniFile,
    buildLengthStyle,
    buildAcronymsStyle,
    buildHeadingCaseStyle,
    buildAcceptedWordsFile,
    buildBannedHeadingsStyle,
} from '#cli/configurations/general/prose/generate.ts';

const CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder | undefined>> = {
    'pytest/coveragerc': buildCoverageFile,
    'ansible/ansible-lint.yml': buildAnsibleLintFile,
    'prose/styles/gspot/acronyms.yml': buildAcronymsStyle,
    'nginx/gixy.cfg': buildGixyFile,
    'postgres/squawk.toml': buildSquawkFile,
    'docker/trivy.yml': buildTrivyFile,
    'bash/shellcheckrc': buildShellcheckFile,
    'commits/commitlint.json': buildCommitlintFile,
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
    'structure/jscpd.json': buildJscpdFile,
    'data-files/taplo.toml': buildTaploFile,
    'docs/lychee.toml': buildLycheeFile,
    'docker/hadolint.yml': buildHadolintFile,
    'openapi/spectral.yml': buildSpectralFile,
    'data-files/v8r.yml': buildV8rFile,
    'dependencies/osv-scanner.toml': buildOsvScannerFile,
    'site/purgecss-safelist.json': buildPurgecssSafelistFile,
    'site/html-validate.json': buildHtmlValidateFile,
    'format/.prettierignore': buildPrettierignoreFile,
    'format/.editorconfig': buildEditorconfigFile,
    'prose/styles/config/vocabularies/words/accept.txt': buildAcceptedWordsFile,
    'prose/vale.ini': buildValeIniFile,
    'prose/commit-message.ini': (planned) =>
        [
            `StylesPath = ${relative(dirname(planned.targetPath), VALE_STYLES_PATH)}`,
            MIN_ALERT_LINE,
            VOCAB_LINE,
            '',
            ALL_FILES_SECTION,
            'BasedOnStyles = gspot',
            `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
        ].join('\n'),
    'prose/styles/gspot/heading-case.yml': buildHeadingCaseStyle,
    'prose/styles/gspot/paragraph-length.yml': (planned) => buildLengthStyle(planned, 'paragraph'),
    'prose/styles/gspot/banned-headings.yml': buildBannedHeadingsStyle,
    'prose/styles/gspot/terms.yml': buildTermsStyle,
    'prose/styles/gspot/sentence-length.yml': (planned) => buildLengthStyle(planned, 'sentence'),
    'prose/styles/gspot/item-length.yml': (planned) => buildLengthStyle(planned, 'item'),
    'spelling/typos.toml': buildTyposFile,
    'python/basedpyright.json': buildBasedpyrightFile,
    'python/ruff.toml': buildRuffFile,
    'css/stylelint.json': buildStylelintFile,
    'html/html-validate.json': buildHtmlValidateFile,
    'swift/periphery.yml': buildPeripheryFile,
    'swift/swiftformat': buildSwiftformatFile,
    'swift/swiftlint.yml': buildSwiftlintFile,
    'javascript/knip.json': buildKnipFile,
    'javascript/biome.json': buildBiomeFile,
    'sql/sqlfluff.cfg': buildSqlfluffFile,
    'javascript/eslint/eslint.mjs': buildEslintFile,
    'javascript/eslint/import-cycles.mjs': () => IMPORT_CYCLES_CONFIG,
    'javascript/jsconfig.json': buildJsconfigFile,
    'format/prettier.json': buildPrettierFile,
};

const CONFIGS = Symbol('config files');

function replaceReferences(
    content: string,
    config: Config,
    targetPath: string,
    targets: ReadonlyMap<string, string> | undefined,
): string {
    let text = content;
    for (const reference of config.references) {
        const mapped = targets?.get(join(dirname(config.target), reference));
        if (mapped !== undefined)
            text = text.replaceAll(`'${reference}'`, () => `'${relative(dirname(targetPath), mapped)}'`);
    }
    return text;
}

function addConfigFailures(generated: ConfigBuildState, owners: OwnedSourceFile[], error: GspotError): void {
    for (const { owner, config } of owners) {
        const scope = owner.scope.path;
        const failures = generated.failures.get(scope) ?? new Map<string, Error>();
        failures.set(config.target, error);
        generated.failures.set(scope, failures);
    }
}

function buildOwnedOutput(
    owned: OwnedSourceFile,
    ownedFiles: OwnedSourceFile[],
    generated: ConfigBuildState,
): BuiltConfig[] {
    try {
        return [{ ...owned, ...buildConfigFile(owned, owned.config.target, generated) }];
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        addConfigFailures(generated, owned.config.per_scope ? [owned] : ownedFiles, error);
        return [];
    }
}

function listToolOutputs(ownedFiles: OwnedSourceFile[], generated: ConfigBuildState): BuiltConfig[][] {
    const owners = ownedFiles[0]?.config.per_scope === true ? ownedFiles : ownedFiles.slice(0, 1);
    const outputs = owners.flatMap((each) => buildOwnedOutput(each, ownedFiles, generated));
    return Map.groupBy(outputs, ({ file }) => file.content)
        .values()
        .toArray()
        .toSorted(
            (left, right) =>
                Number(right.some(({ owner }) => owner.scope.path === '')) -
                    Number(left.some(({ owner }) => owner.scope.path === '')) || right.length - left.length,
        );
}

function addToolOutput(target: string, group: BuiltConfig[], index: number, generated: ConfigBuildState): void {
    const [first] = group as [BuiltConfig, ...BuiltConfig[]];
    const written = index === 0 ? target : buildPerScopeTarget(first.config, first.owner.scope.path);
    const { file, companions } = written === target ? first : buildConfigFile(first, written, generated);
    for (const written of [file, ...companions]) generated.files.set(written.path, written);
    for (const { owner } of group) {
        const scope = owner.scope.path;
        const paths = generated.targets.get(scope) ?? new Map<string, string>();
        paths.set(target, written);
        generated.targets.set(scope, paths);
    }
}

function addSourceFiles(configs: OwnedConfig[], generated: ConfigBuildState): void {
    const sourced = configs.filter((each): each is OwnedSourceFile => each.config.source !== undefined);
    const sources = Map.groupBy(sourced, ({ config }) => config.target);
    for (const [target, ownedFiles] of sources) {
        const groups = listToolOutputs(ownedFiles, generated);
        for (const [index, group] of groups.entries()) addToolOutput(target, group, index, generated);
    }
}

function listTargetPointers(configs: OwnedConfig[], selected: OwnedConfig): Set<string> {
    return new Set(
        configs
            .filter(
                (each) =>
                    each.owner.scope.path === selected.owner.scope.path &&
                    each.config.source === undefined &&
                    each.config.target === selected.config.target,
            )
            .flatMap((each) => listPointerPaths(each.owner, each.config)),
    );
}

function listPointerTargets(
    selected: OwnedConfig,
    configs: OwnedConfig[],
    generated: ConfigBuildState,
): Map<string, string> {
    const { config } = selected;
    const owners =
        config.pointer?.overrides === true
            ? configs.filter(
                  (each) =>
                      each.config.target === config.target &&
                      generated.failures.get(each.owner.scope.path)?.has(config.target) !== true,
              )
            : [selected];
    return new Map(
        owners.map((each) => [each.owner.scope.path, getConfigTarget(each.owner.scope.path, each.config, generated)]),
    );
}

function addPointerFiles(selected: OwnedConfig, configs: OwnedConfig[], generated: ConfigBuildState): void {
    const { config, owner } = selected;
    if (isPointerInherited(selected, generated)) return;
    const targetPointers = listTargetPointers(configs, selected);
    const pointers = buildPointerFiles(owner, config, listPointerTargets(selected, configs, generated));
    for (const pointer of pointers) {
        if (config.source === undefined || config.pointer?.folders !== undefined || !targetPointers.has(pointer.path))
            generated.files.set(pointer.path, pointer);
    }
}

function buildScopeConfigs(session: Session): ConfigGeneration {
    const configs = listOwnedConfigs(session);
    const state: ConfigBuildState = { targets: new Map(), files: new Map(), failures: new Map(), ignoreSections: [] };
    // A tool that inherits its parent config reads no ignores, and the ignores leave out the pointers it does not need.
    addSourceFiles(
        configs.filter(({ config }) => config.pointer?.inherit === true),
        state,
    );
    state.ignoreSections = buildIgnoreSections(session, state);
    addSourceFiles(
        configs.filter(({ config }) => config.pointer?.inherit !== true),
        state,
    );
    for (const config of configs)
        if (state.failures.get(config.owner.scope.path)?.has(config.config.target) !== true)
            addPointerFiles(config, configs, state);
    return { files: state.files.values().toArray(), targets: state.targets, failures: state.failures };
}

function buildPerScopeTarget(config: Pick<Config, 'target' | 'file' | 'root'>, scopePath: string): string {
    if (config.root) return join(scopePath, config.target);
    const folder = config.target.slice(0, config.target.length - config.file.length);
    return join(folder, CONFIG_SCOPES_FOLDER, scopePath, config.file);
}

/**
Build the text of one config file, and of the files that it imports.

@param owned the config file and the scope that owns it.
@param targetPath the repository path where gspot writes the file.
@param generated the config paths and shared ignore sections.
@returns the generated file, with paths relative to where it sits, and its companion files.
*/
function buildConfigFile(
    owned: OwnedSourceFile,
    targetPath: string,
    generated: Pick<ConfigBuildState, 'targets' | 'ignoreSections'>,
): Pick<BuiltConfig, 'file' | 'companions'> {
    const { config, owner } = owned;
    const planned: PlannedConfig = {
        ...owner,
        config,
        targetPath,
        ignoreSections: generated.ignoreSections,
        level: owner.session.settings.level,
    };
    const builder = CONFIG_BUILDERS[`${planned.configuration.name}/${config.file}`];
    let built: ReturnType<ConfigBuilder>;
    if (builder === undefined) {
        const source = config.source;
        const shipped = readFileSync(buildAssetPath(`${planned.configuration.folder}/${source}`), 'utf8');
        const ts = source.endsWith(TS_EXTENSION) ? requireTypescript() : undefined;
        built =
            ts === undefined
                ? shipped
                : ts.transpileModule(shipped, {
                      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
                  }).outputText;
    } else built = builder(planned);
    const { content, companions } = typeof built === 'string' ? { content: built, companions: [] } : built;
    const source = replaceReferences(content, config, targetPath, generated.targets.get(planned.scope.path));
    return {
        file: { path: targetPath, content: `${formatHeader(targetPath)}${source.trimEnd()}\n` },
        companions: companions.map((companion) => ({
            path: companion.path,
            content: `${formatHeader(companion.path)}${companion.content.trimEnd()}\n`,
        })),
    };
}

/**
Reuse generated settings only while the session keeps the same run cache.

@param session the current settings, scopes, and repository files.
*/
export function buildConfigs(session: Session): ConfigGeneration {
    const repositorySession =
        session.root === session.repository.root ? session : { ...session, root: session.repository.root };
    return remember(session.cache, CONFIGS, session.repository, () => buildScopeConfigs(repositorySession));
}
