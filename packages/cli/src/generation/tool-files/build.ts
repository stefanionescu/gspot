import { readAsset } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { buildKnipFile } from '#cli/generation/tool-files/knip.ts';
import { buildJscpdFile } from '#cli/generation/tool-files/jscpd.ts';
import { buildTyposFile } from '#cli/generation/tool-files/typos.ts';
import { buildEslintFile } from '#cli/generation/eslint/tool-file.ts';
import { buildJsconfig } from '#cli/generation/tool-files/jsconfig.ts';
import { buildSquawkFile } from '#cli/generation/tool-files/squawk.ts';
import { buildSemgrepFile } from '#cli/generation/tool-files/semgrep.ts';
import { buildHadolintFile } from '#cli/generation/tool-files/hadolint.ts';
import { buildPrettierFile } from '#cli/generation/tool-files/prettier.ts';
import { buildSqlfluffFile } from '#cli/generation/tool-files/sqlfluff.ts';
import { buildYamllintFile } from '#cli/generation/tool-files/yamllint.ts';
import { MARKDOWNLINT_CLI_TEXT } from '#cli/config/generation/tool-files.ts';
import { buildStylelintFile } from '#cli/generation/tool-files/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/tool-files/swiftlint.ts';
import { buildCommitlintFile } from '#cli/generation/tool-files/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/tool-files/shellcheck.ts';
import { buildSwiftformatFile } from '#cli/generation/tool-files/swiftformat.ts';
import { buildEditorconfigFile } from '#cli/generation/tool-files/editorconfig.ts';
import { buildMarkdownlintFile } from '#cli/generation/tool-files/markdownlint.ts';
import { buildSemgrepignore, buildPrettierignore } from '#cli/generation/ignore-files.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/generation/tool-files/python.ts';
import { ESLINT_RUNTIME_FILE, ESLINT_RUNTIME_TARGET } from '#cli/config/generation/eslint.ts';
import { TOOL_FILE_REFERENCE, SEMGREP_RULE_PACK_FOLDER } from '#cli/config/generation/files.ts';
import { buildBuiltHtmlFile, buildSourceHtmlFile } from '#cli/generation/tool-files/html-validate.ts';

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
} from '#cli/generation/tool-files/plain.ts';
import {
    buildValeIniFile,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildListItemStyle,
    buildPossessivesStyle,
    buildAcceptedWordsFile,
    buildCapitalizationStyle,
    buildBannedHeadingsStyle,
    buildSentenceLengthStyle,
    buildParagraphLengthStyle,
} from '#cli/generation/tool-files/vale.ts';

const builders: Readonly<Record<string, ToolFileBuilder | undefined>> = {
    [ESLINT_RUNTIME_TARGET]: (context) => readAsset(`${context.manifest.folder}/${ESLINT_RUNTIME_FILE}`),
    '.gspot/config/ansible-lint.yml': buildAnsibleLintFile,
    '.gspot/config/vale/styles/gspot/acronyms.yml': buildAcronymsStyle,
    '.gspot/config/gixy.cfg': buildGixyFile,
    '.gspot/config/squawk.toml': buildSquawkFile,
    '.gspot/config/trivy.yml': buildTrivyFile,
    '.gspot/config/shellcheckrc': buildShellcheckFile,
    '.gspot/config/commitlint.config.cjs': buildCommitlintFile,
    '.gspot/config/markdownlint.jsonc': buildMarkdownlintFile,
    '.gspot/config/markdownlint-cli2.mjs': () => MARKDOWNLINT_CLI_TEXT,
    '.gspot/config/jscpd.json': buildJscpdFile,
    '.gspot/config/taplo.toml': buildTaploFile,
    '.gspot/config/lychee.toml': buildLycheeFile,
    '.gspot/config/hadolint.yml': buildHadolintFile,
    '.gspot/config/spectral.yaml': buildSpectralFile,
    '.gspot/config/v8r.yml': buildV8rFile,
    '.gspot/config/yamllint.yml': buildYamllintFile,
    '.gspot/config/osv-scanner.toml': buildOsvScannerFile,
    '.gspot/config/purgecss.config.mjs': buildPurgecssFile,
    '.gspot/config/html-validate-built.json': buildBuiltHtmlFile,
    '.semgrepignore': buildSemgrepignore,
    '.prettierignore': buildPrettierignore,
    '.editorconfig': buildEditorconfigFile,
    '.gspot/config/vale/styles/config/vocabularies/words/accept.txt': buildAcceptedWordsFile,
    '.gspot/config/vale.ini': buildValeIniFile,
    '.gspot/config/vale/styles/gspot/heading-case.yml': buildCapitalizationStyle,
    '.gspot/config/vale/styles/gspot/paragraph-length.yml': buildParagraphLengthStyle,
    '.gspot/config/vale/styles/gspot/alt-text.yml': buildAltTextStyle,
    '.gspot/config/vale/styles/gspot/banned-headings.yml': buildBannedHeadingsStyle,
    '.gspot/config/vale/styles/gspot/sentence-length.yml': buildSentenceLengthStyle,
    '.gspot/config/vale/styles/gspot/title-case.yml': buildCapitalizationStyle,
    '.gspot/config/vale/styles/gspot/item-length.yml': buildListItemStyle,
    '.gspot/config/vale/styles/gspot/possessives.yml': buildPossessivesStyle,
    '.gspot/config/typos.toml': buildTyposFile,
    '.gspot/config/basedpyrightconfig.json': buildBasedpyrightFile,
    '.gspot/config/ruff.toml': buildRuffFile,
    '.gspot/config/stylelint.json': buildStylelintFile,
    '.gspot/config/html-validate-source.json': buildSourceHtmlFile,
    '.gspot/config/periphery.yml': buildPeripheryFile,
    '.gspot/config/swiftformat': buildSwiftformatFile,
    '.gspot/config/swiftlint.yml': buildSwiftlintFile,
    '.gspot/config/knip.json': buildKnipFile,
    '.gspot/config/sqlfluff.cfg': buildSqlfluffFile,
    '.gspot/config/eslint.config.mjs': buildEslintFile,
    '.gspot/config/jsconfig.json': buildJsconfig,
    '.gspot/config/prettier.json': buildPrettierFile,
    [SEMGREP_RULE_PACK_FOLDER]: buildSemgrepFile,
};
/**
 * Build one target file and its declared pointers.
 * @param context the declared output, its owner, and the selected scope settings.
 * @param targets the generated tool files chosen for each scope.
 * @returns the generated file with companion paths relative to its chosen location.
 */
function buildToolFile(context: ToolFileContext, targets: ToolFileGeneration['targets']): GeneratedFile {
    const { toolFile, targetPath } = context;
    const folder = toolFile.target.slice(0, toolFile.target.lastIndexOf('/') + 1);
    const builder = builders[toolFile.target] ?? builders[folder];
    const source = (
        builder === undefined ? readAsset(`${context.manifest.folder}/${toolFile.source}`) : builder(context)
    ).replaceAll(TOOL_FILE_REFERENCE, (match: string, ...replacementArguments: unknown[]) => {
        const groups = replacementArguments.at(-1) as { path: string };
        const declared = join(dirname(toolFile.target), groups.path);
        const chosen = targets.get(context.selection.scope.path)?.get(declared);
        return chosen === undefined ? match : match.replace(groups.path, relative(dirname(targetPath), chosen));
    });
    return {
        path: targetPath,
        content: `${formatHeader(targetPath)}${source.trimEnd()}\n`,
        kind: 'tool_file',
    };
}

export { buildToolFile };
