import { readAsset } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { buildEslintFile } from '#cli/generation/eslint/tool-file.ts';
import { buildV8rFile } from '#cli/generation/settings/builders/v8r.ts';
import { buildGixyFile } from '#cli/generation/settings/builders/gixy.ts';
import { buildKnipFile } from '#cli/generation/settings/builders/knip.ts';
import { buildRuffFile } from '#cli/generation/settings/builders/ruff.ts';
import { buildJscpdFile } from '#cli/generation/settings/builders/jscpd.ts';
import { buildTaploFile } from '#cli/generation/settings/builders/taplo.ts';
import { buildTrivyFile } from '#cli/generation/settings/builders/trivy.ts';
import { buildTyposFile } from '#cli/generation/settings/builders/typos.ts';
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
import { buildPrettierignoreFile } from '#cli/generation/settings/ignore-files.ts';
import { buildPeripheryFile } from '#cli/generation/settings/builders/periphery.ts';
import { buildStylelintFile } from '#cli/generation/settings/builders/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/settings/builders/swiftlint.ts';
import { buildCommitlintFile } from '#cli/generation/settings/builders/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/settings/builders/shellcheck.ts';
import { buildOsvScannerFile } from '#cli/generation/settings/builders/osv-scanner.ts';
import { buildSwiftformatFile } from '#cli/generation/settings/builders/swiftformat.ts';
import { buildAnsibleLintFile } from '#cli/generation/settings/builders/ansible-lint.ts';
import { buildBasedpyrightFile } from '#cli/generation/settings/builders/basedpyright.ts';
import { buildEditorconfigFile } from '#cli/generation/settings/builders/editorconfig.ts';
import { buildMarkdownlintFile } from '#cli/generation/settings/builders/markdownlint.ts';
import { TOOL_FILE_REFERENCE, SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/settings/build.ts';

import {
    type GeneratedFile,
    type ToolFileBuilder,
    type PlannedToolFile,
    type ToolFileGeneration,
} from '#cli/types/generation/files.ts';
import {
    buildValeIniFile,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildListItemStyle,
    buildTitleCaseStyle,
    buildPossessivesStyle,
    buildHeadingCaseStyle,
    buildAcceptedWordsFile,
    buildBannedHeadingsStyle,
    buildSentenceLengthStyle,
    buildParagraphLengthStyle,
} from '#cli/generation/settings/builders/vale.ts';

const TOOL_FILE_BUILDERS: Readonly<Record<string, ToolFileBuilder | undefined>> = {
    'ansible/ansible-lint.yml': buildAnsibleLintFile,
    'prose/styles/gspot/acronyms.yml': buildAcronymsStyle,
    'nginx/gixy.cfg': buildGixyFile,
    'postgres/squawk.toml': buildSquawkFile,
    'docker/trivy.yml': buildTrivyFile,
    'bash/shellcheckrc': buildShellcheckFile,
    'commits/commitlint.json': buildCommitlintFile,
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
    'duplication/jscpd.json': buildJscpdFile,
    'files/taplo.toml': buildTaploFile,
    'docs/lychee.toml': buildLycheeFile,
    'docker/hadolint.yml': buildHadolintFile,
    'openapi/spectral.yml': buildSpectralFile,
    'files/v8r.yml': buildV8rFile,
    'files/yamllint.yml': buildYamllintFile,
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
        builder === undefined ? readAsset(`${planned.configuration.folder}/${toolFile.source}`) : builder(planned)
    ).replaceAll(TOOL_FILE_REFERENCE, (match: string, path: string) => {
        const declared = join(dirname(toolFile.target), path);
        const chosen = targets.get(planned.selection.scope.path)?.get(declared);
        return chosen === undefined ? match : match.replace(path, relative(dirname(targetPath), chosen));
    });
    return {
        path: targetPath,
        content: `${formatHeader(targetPath)}${source.trimEnd()}\n`,
    };
}
