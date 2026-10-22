import { readFileSync } from 'node:fs';
import { stringify as stringifyYaml } from 'yaml';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { buildEslintFile } from '#cli/generation/eslint/config-file.ts';
import { buildV8rFile } from '#cli/generation/config-files/builders/v8r.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';
import { buildGixyFile } from '#cli/generation/config-files/builders/gixy.ts';
import { buildKnipFile } from '#cli/generation/config-files/builders/knip.ts';
import { buildRuffFile } from '#cli/generation/config-files/builders/ruff.ts';
import { buildTaploFile } from '#cli/generation/config-files/builders/taplo.ts';
import { buildTyposFile } from '#cli/generation/config-files/builders/typos.ts';
import { buildHtmlSettings } from '#cli/generation/config-files/builders/html.ts';
import { buildLycheeFile } from '#cli/generation/config-files/builders/lychee.ts';
import { buildSquawkFile } from '#cli/generation/config-files/builders/squawk.ts';
import { buildSemgrepFile } from '#cli/generation/config-files/builders/semgrep.ts';
import { buildHadolintFile } from '#cli/generation/config-files/builders/hadolint.ts';
import { buildJsconfigFile } from '#cli/generation/config-files/builders/jsconfig.ts';
import { buildPrettierFile } from '#cli/generation/config-files/builders/prettier.ts';
import { buildPurgecssFile } from '#cli/generation/config-files/builders/purgecss.ts';
import { buildSpectralFile } from '#cli/generation/config-files/builders/spectral.ts';
import { buildSqlfluffFile } from '#cli/generation/config-files/builders/sqlfluff.ts';
import { buildYamllintFile } from '#cli/generation/config-files/builders/yamllint.ts';
import { buildPeripheryFile } from '#cli/generation/config-files/builders/periphery.ts';
import { buildStylelintFile } from '#cli/generation/config-files/builders/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/config-files/builders/swiftlint.ts';
import { buildCommitlintFile } from '#cli/generation/config-files/builders/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/config-files/builders/shellcheck.ts';
import { buildOsvScannerFile } from '#cli/generation/config-files/builders/osv-scanner.ts';
import { buildSwiftformatFile } from '#cli/generation/config-files/builders/swiftformat.ts';
import { TRIVY_SKIPPED_FOLDERS } from '#cli/config/generation/config-files/builders/trivy.ts';
import { buildBasedpyrightFile } from '#cli/generation/config-files/builders/basedpyright.ts';
import { buildEditorconfigFile } from '#cli/generation/config-files/builders/editorconfig.ts';
import { buildMarkdownlintFile } from '#cli/generation/config-files/builders/markdownlint.ts';
import { ANSIBLE_LINT_ALWAYS_OFF } from '#cli/config/generation/config-files/builders/ansible-lint.ts';
import { CONFIG_FILE_REFERENCE, SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/config-files/build.ts';
import { JSCPD_IGNORED, JSCPD_IMPORT_PATTERNS } from '#cli/config/generation/config-files/builders/jscpd.ts';

import {
    type GeneratedFile,
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
} from '#cli/generation/config-files/builders/vale.ts';

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
    'javascript/eslint.mjs': buildEslintFile,
    'javascript/jsconfig.json': buildJsconfigFile,
    'format/prettier.json': buildPrettierFile,
};

/**
 * Build the text of one config file.
 *
 * @param planned the config file with its scope, level, and target path.
 * @param targets the config file path for each scope.
 * @returns the generated file, with paths relative to where it sits.
 */
export function buildConfigFile(planned: PlannedConfigFile, targets: ConfigFileGeneration['targets']): GeneratedFile {
    const { configFile, targetPath } = planned;
    // Every semgrep.yml config file has the same builder; any other config file has its own, keyed by configuration and
    // file.
    const builder =
        configFile.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : CONFIG_FILE_BUILDERS[`${planned.configuration.name}/${configFile.file}`];
    const source = (
        builder === undefined
            ? readFileSync(buildAssetPath(`${planned.configuration.folder}/${configFile.source}`), 'utf8')
            : builder(planned)
    ).replaceAll(CONFIG_FILE_REFERENCE, (match: string, path: string) => {
        const declared = join(dirname(configFile.target), path);
        const chosen = targets.get(planned.scope.folder.path)?.get(declared);
        return chosen === undefined ? match : match.replace(path, relative(dirname(targetPath), chosen));
    });
    return {
        path: targetPath,
        content: `${formatHeader(targetPath)}${source.trimEnd()}\n`,
    };
}
