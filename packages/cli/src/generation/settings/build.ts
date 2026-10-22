import { readFileSync } from 'node:fs';
import { stringify as stringifyYaml } from 'yaml';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { buildEslintFile } from '#cli/generation/eslint/tool-file.ts';
import { buildV8rFile } from '#cli/generation/settings/builders/v8r.ts';
import { buildGixyFile } from '#cli/generation/settings/builders/gixy.ts';
import { buildKnipFile } from '#cli/generation/settings/builders/knip.ts';
import { buildRuffFile } from '#cli/generation/settings/builders/ruff.ts';
import { buildTaploFile } from '#cli/generation/settings/builders/taplo.ts';
import { buildTyposFile } from '#cli/generation/settings/builders/typos.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';
import { buildHtmlSettings } from '#cli/generation/settings/builders/html.ts';
import { buildLycheeFile } from '#cli/generation/settings/builders/lychee.ts';
import { buildSquawkFile } from '#cli/generation/settings/builders/squawk.ts';
import { buildSemgrepFile } from '#cli/generation/settings/builders/semgrep.ts';
import { buildHadolintFile } from '#cli/generation/settings/builders/hadolint.ts';
import { buildJsconfigFile } from '#cli/generation/settings/builders/jsconfig.ts';
import { buildPrettierFile } from '#cli/generation/settings/builders/prettier.ts';
import { buildPurgecssFile } from '#cli/generation/settings/builders/purgecss.ts';
import { buildSpectralFile } from '#cli/generation/settings/builders/spectral.ts';
import { buildSqlfluffFile } from '#cli/generation/settings/builders/sqlfluff.ts';
import { buildYamllintFile } from '#cli/generation/settings/builders/yamllint.ts';
import { buildPeripheryFile } from '#cli/generation/settings/builders/periphery.ts';
import { buildStylelintFile } from '#cli/generation/settings/builders/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/settings/builders/swiftlint.ts';
import { buildCommitlintFile } from '#cli/generation/settings/builders/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/settings/builders/shellcheck.ts';
import { buildOsvScannerFile } from '#cli/generation/settings/builders/osv-scanner.ts';
import { buildSwiftformatFile } from '#cli/generation/settings/builders/swiftformat.ts';
import { TRIVY_SKIPPED_FOLDERS } from '#cli/config/generation/settings/builders/trivy.ts';
import { buildBasedpyrightFile } from '#cli/generation/settings/builders/basedpyright.ts';
import { buildEditorconfigFile } from '#cli/generation/settings/builders/editorconfig.ts';
import { buildMarkdownlintFile } from '#cli/generation/settings/builders/markdownlint.ts';
import { ANSIBLE_LINT_ALWAYS_OFF } from '#cli/config/generation/settings/builders/ansible-lint.ts';
import { TOOL_FILE_REFERENCE, SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/settings/build.ts';
import { JSCPD_IGNORED, JSCPD_IMPORT_PATTERNS } from '#cli/config/generation/settings/builders/jscpd.ts';

import {
    type GeneratedFile,
    type PlannedToolFile,
    type ToolFileBuilder,
    type ToolFileGeneration,
} from '#cli/types/generation/files.ts';
import {
    convertToGlobs,
    buildIgnoreSections,
    buildPrettierignoreFile,
    listCheckIgnoreSections,
} from '#cli/generation/settings/ignore-files.ts';
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
} from '#cli/generation/settings/builders/vale.ts';

const TOOL_FILE_BUILDERS: Readonly<Record<string, ToolFileBuilder | undefined>> = {
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
 * Build one tool file and its pointers.
 *
 * @param planned the tool file to build.
 * @param targets the tool file path for each scope.
 * @returns the generated file, with paths relative to where it sits.
 */
export function buildToolFile(planned: PlannedToolFile, targets: ToolFileGeneration['targets']): GeneratedFile {
    const { toolFile, targetPath } = planned;
    // Every Semgrep rule pack has the same builder; any other tool file has its own by configuration and file.
    const builder =
        toolFile.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : TOOL_FILE_BUILDERS[`${planned.configuration.name}/${toolFile.file}`];
    const source = (
        builder === undefined
            ? readFileSync(buildAssetPath(`${planned.configuration.folder}/${toolFile.source}`), 'utf8')
            : builder(planned)
    ).replaceAll(TOOL_FILE_REFERENCE, (match: string, path: string) => {
        const declared = join(dirname(toolFile.target), path);
        const chosen = targets.get(planned.scope.folder.path)?.get(declared);
        return chosen === undefined ? match : match.replace(path, relative(dirname(targetPath), chosen));
    });
    return {
        path: targetPath,
        content: `${formatHeader(targetPath)}${source.trimEnd()}\n`,
    };
}
