import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { JSON_INDENT } from '#cli/config/text.ts';
import { stringify as stringifyYaml } from 'yaml';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import { buildSemgrepFile } from '#cli/generation/config-files/semgrep.ts';
import { buildSquawkFile } from '#cli/generation/configurations/postgres.ts';
import { buildLycheeFile } from '#cli/generation/configurations/general/docs.ts';
import { buildHtmlSettings } from '#cli/generation/config-files/html-validate.ts';
import { buildSqlfluffFile } from '#cli/generation/configurations/language/sql.ts';
import { buildTyposFile } from '#cli/generation/configurations/general/spelling.ts';
import { buildStylelintFile } from '#cli/generation/configurations/language/css.ts';
import { buildPurgecssFile } from '#cli/generation/configurations/framework/site.ts';
import { buildShellcheckFile } from '#cli/generation/configurations/language/bash.ts';
import { buildGixyFile } from '#cli/generation/configurations/infrastructure/nginx.ts';
import { buildRuffFile } from '#cli/generation/configurations/language/python/ruff.ts';
import { buildCommitlintFile } from '#cli/generation/configurations/general/commits.ts';
import { buildV8rFile } from '#cli/generation/configurations/general/data-files/v8r.ts';
import { buildKnipFile } from '#cli/generation/configurations/language/javascript/knip.ts';
import { buildTaploFile } from '#cli/generation/configurations/general/data-files/taplo.ts';
import { buildHadolintFile } from '#cli/generation/configurations/infrastructure/docker.ts';
import { buildMarkdownlintFile } from '#cli/generation/configurations/language/markdown.ts';
import { buildOsvScannerFile } from '#cli/generation/configurations/general/dependencies.ts';
import { buildSpectralFile } from '#cli/generation/configurations/infrastructure/openapi.ts';
import { buildPrettierFile } from '#cli/generation/configurations/general/format/prettier.ts';
import { buildPeripheryFile } from '#cli/generation/configurations/language/swift/periphery.ts';
import { buildSwiftlintFile } from '#cli/generation/configurations/language/swift/swiftlint.ts';
import { buildYamllintFile } from '#cli/generation/configurations/general/data-files/yamllint.ts';
import { buildJsconfigFile } from '#cli/generation/configurations/language/javascript/jsconfig.ts';
import { buildSwiftformatFile } from '#cli/generation/configurations/language/swift/swiftformat.ts';
import { buildEditorconfigFile } from '#cli/generation/configurations/general/format/editorconfig.ts';
import { buildBasedpyrightFile } from '#cli/generation/configurations/language/python/basedpyright.ts';
import { buildEslintFile } from '#cli/generation/configurations/language/javascript/eslint/config-file.ts';

import {
    type BuiltConfigFile,
    type PlannedConfigFile,
    type ConfigFileBuilder,
    type ConfigFileGeneration,
} from '#cli/types/generation/files.ts';
import {
    convertToGlobs,
    buildIgnoreSections,
    buildPrettierignoreFile,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';
import {
    JSCPD_IGNORED,
    TRANSPILE_OPTIONS,
    TRIVY_SKIPPED_FOLDERS,
    JSCPD_IMPORT_PATTERNS,
    CONFIG_FILE_REFERENCE,
    SEMGREP_RULE_PACK_FILE,
    ANSIBLE_LINT_ALWAYS_OFF,
} from '#cli/config/generation/config-files/build.ts';
import {
    buildValeIniFile,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildListItemStyle,
    buildTitleCaseStyle,
    buildHeadingCaseStyle,
    buildPossessivesStyle,
    buildAcceptedWordsFile,
    buildBannedHeadingsStyle,
    buildSentenceLengthStyle,
    buildParagraphLengthStyle,
} from '#cli/generation/configurations/general/prose.ts';

const CONFIG_FILE_BUILDERS: Readonly<Record<string, ConfigFileBuilder | undefined>> = {
    'ansible/ansible-lint.yml': (planned) =>
        stringifyYaml({
            skip_list: [
                ...new Set([...ANSIBLE_LINT_ALWAYS_OFF, ...listIgnoredRules(planned.scope, 'ansible/ansible-lint')]),
            ],
        }),
    'prose/styles/gspot/acronyms.yml': buildAcronymsStyle,
    'nginx/gixy.cfg': buildGixyFile,
    'postgres/squawk.toml': buildSquawkFile,
    'docker/trivy.yml': (planned) =>
        stringifyYaml({
            timeout: `${String(planned.session.settingsFile.settings.tool_timeout_seconds)}s`,
            severity: getTable(planned.scope.settings, 'tools.trivy').severity,
            scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
        }),
    'bash/shellcheckrc': buildShellcheckFile,
    'commits/commitlint.json': buildCommitlintFile,
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
    'duplication/jscpd.json': (planned) =>
        JSON.stringify(
            {
                mode: 'strict',
                minLines: getTable(planned.scope.settings, 'duplication').min_lines,
                minTokens: getTable(planned.scope.settings, 'duplication').min_tokens,
                absolute: true,
                gitignore: true,
                ignorePattern: JSCPD_IMPORT_PATTERNS,
                ignore: [
                    ...JSCPD_IGNORED,
                    ...convertToGlobs([
                        ...buildIgnoreSections(planned.session),
                        ...listCheckIgnoreSections(planned.scope.settings, 'duplication/jscpd'),
                    ]),
                ],
            },
            null,
            JSON_INDENT,
        ),
    'data-files/taplo.toml': buildTaploFile,
    'docs/lychee.toml': buildLycheeFile,
    'docker/hadolint.yml': buildHadolintFile,
    'openapi/spectral.yml': buildSpectralFile,
    'data-files/v8r.yml': buildV8rFile,
    'data-files/yamllint.yml': buildYamllintFile,
    'dependencies/osv-scanner.toml': buildOsvScannerFile,
    'site/purgecss.mjs': buildPurgecssFile,
    'site/html-validate.json': buildHtmlSettings,
    'format/.prettierignore': buildPrettierignoreFile,
    'format/.editorconfig': buildEditorconfigFile,
    'prose/styles/config/vocabularies/words/accept.txt': buildAcceptedWordsFile,
    'prose/vale.ini': buildValeIniFile,
    'prose/styles/gspot/heading-case.yml': buildHeadingCaseStyle,
    'prose/styles/gspot/paragraph-length.yml': buildParagraphLengthStyle,
    'prose/styles/gspot/alt-text.yml': buildAltTextStyle,
    'prose/styles/gspot/banned-headings.yml': buildBannedHeadingsStyle,
    'prose/styles/gspot/sentence-length.yml': buildSentenceLengthStyle,
    'prose/styles/gspot/title-case.yml': buildTitleCaseStyle,
    'prose/styles/gspot/item-length.yml': buildListItemStyle,
    'prose/styles/gspot/possessives.yml': buildPossessivesStyle,
    'spelling/typos.toml': buildTyposFile,
    'python/basedpyright.json': buildBasedpyrightFile,
    'python/ruff.toml': buildRuffFile,
    'css/stylelint.json': buildStylelintFile,
    'html/html-validate.json': buildHtmlSettings,
    'swift/periphery.yml': buildPeripheryFile,
    'swift/swiftformat': buildSwiftformatFile,
    'swift/swiftlint.yml': buildSwiftlintFile,
    'javascript/knip.json': buildKnipFile,
    'sql/sqlfluff.cfg': buildSqlfluffFile,
    'javascript/eslint/eslint.mjs': buildEslintFile,
    'javascript/jsconfig.json': buildJsconfigFile,
    'format/prettier.json': buildPrettierFile,
};

/**
 * Build the text of one config file, and of the files that it imports.
 *
 * @param planned the config file with its scope, level, and target path.
 * @param targets the config file path for each scope.
 * @returns the generated file, with paths relative to where it sits, and its companion files.
 */
export function buildConfigFile(
    planned: PlannedConfigFile,
    targets: ConfigFileGeneration['targets'],
): Pick<BuiltConfigFile, 'file' | 'companions'> {
    const { configFile, targetPath } = planned;
    // Every semgrep.yml config file has the same builder; any other config file has its own, keyed by configuration and
    // file.
    const builder =
        configFile.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : CONFIG_FILE_BUILDERS[`${planned.configuration.name}/${configFile.file}`];
    let built: ReturnType<ConfigFileBuilder>;
    if (builder === undefined) {
        // A shipped TypeScript source becomes the JavaScript module that the target names.
        const shipped = readFileSync(buildAssetPath(`${planned.configuration.folder}/${configFile.source}`), 'utf8');
        built = configFile.source.endsWith('.ts')
            ? ts.transpileModule(shipped, { compilerOptions: TRANSPILE_OPTIONS }).outputText
            : shipped;
    } else built = builder(planned);
    const { content, companions } = typeof built === 'string' ? { content: built, companions: [] } : built;
    const source = content.replaceAll(CONFIG_FILE_REFERENCE, (match: string, path: string) => {
        const declared = join(dirname(configFile.target), path);
        const chosen = targets.get(planned.scope.folder.path)?.get(declared);
        return chosen === undefined ? match : match.replace(path, relative(dirname(targetPath), chosen));
    });
    return {
        file: { path: targetPath, content: `${formatHeader(targetPath)}${source.trimEnd()}\n` },
        companions: companions.map((companion) => ({
            path: companion.path,
            content: `${formatHeader(companion.path)}${companion.content.trimEnd()}\n`,
        })),
    };
}
