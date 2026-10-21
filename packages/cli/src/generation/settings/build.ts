import { readAsset } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { buildKnipFile } from '#cli/generation/settings/knip.ts';
import { buildJscpdFile } from '#cli/generation/settings/jscpd.ts';
import { buildTyposFile } from '#cli/generation/settings/typos.ts';
import { buildHtmlSettings } from '#cli/generation/settings/html.ts';
import { buildJsconfig } from '#cli/generation/settings/jsconfig.ts';
import { buildSquawkFile } from '#cli/generation/settings/squawk.ts';
import { buildEslintFile } from '#cli/generation/eslint/tool-file.ts';
import { buildPrettierignore } from '#cli/generation/ignore-files.ts';
import { buildSemgrepFile } from '#cli/generation/settings/semgrep.ts';
import { buildHadolintFile } from '#cli/generation/settings/hadolint.ts';
import { buildPrettierFile } from '#cli/generation/settings/prettier.ts';
import { buildSqlfluffFile } from '#cli/generation/settings/sqlfluff.ts';
import { buildYamllintFile } from '#cli/generation/settings/yamllint.ts';
import { buildStylelintFile } from '#cli/generation/settings/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/settings/swiftlint.ts';
import { buildCommitlintFile } from '#cli/generation/settings/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/settings/shellcheck.ts';
import { buildSwiftformatFile } from '#cli/generation/settings/swiftformat.ts';
import { buildEditorconfigFile } from '#cli/generation/settings/editorconfig.ts';
import { buildMarkdownlintFile } from '#cli/generation/settings/markdownlint.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/generation/settings/python.ts';
import { TOOL_FILE_REFERENCE, SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/files.ts';

import {
    type GeneratedFile,
    type ToolFileBuilder,
    type ToolFileContext,
    type ToolFileGeneration,
} from '#cli/types/generation/files.ts';
import {
    buildV8rFile,
    buildGixyFile,
    buildTaploFile,
    buildTrivyFile,
    buildLycheeFile,
    buildPurgecssFile,
    buildSpectralFile,
    buildPeripheryFile,
    buildOsvScannerFile,
    buildAnsibleLintFile,
} from '#cli/generation/settings/plain.ts';
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
} from '#cli/generation/settings/vale.ts';

const builders: Readonly<Record<string, ToolFileBuilder | undefined>> = {
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
    'format/.prettierignore': buildPrettierignore,
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
    'javascript/jsconfig.json': buildJsconfig,
    'format/prettier.json': buildPrettierFile,
};
/**
 * Build one tool file and its pointers.
 *
 * @param context the tool file to build.
 * @param targets the tool file path for each scope.
 * @returns the generated file, with paths relative to where it sits.
 */
function buildToolFile(context: ToolFileContext, targets: ToolFileGeneration['targets']): GeneratedFile {
    const { toolFile, targetPath } = context;
    // Every Semgrep rule pack has the same builder; any other tool file has its own by configuration and file.
    const builder =
        toolFile.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : builders[`${context.manifest.configuration.name}/${toolFile.file}`];
    const source = (
        builder === undefined ? readAsset(`${context.manifest.folder}/${toolFile.source}`) : builder(context)
    ).replaceAll(TOOL_FILE_REFERENCE, (match: string, path: string) => {
        const declared = join(dirname(toolFile.target), path);
        const chosen = targets.get(context.selection.scope.path)?.get(declared);
        return chosen === undefined ? match : match.replace(path, relative(dirname(targetPath), chosen));
    });
    return {
        path: targetPath,
        content: `${formatHeader(targetPath)}${source.trimEnd()}\n`,
    };
}

export { buildToolFile };
