import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { buildSemgrepFile } from '#cli/generation/config-files/semgrep.ts';
import { buildSquawkFile } from '#cli/generation/configurations/postgres.ts';
import { buildLycheeFile } from '#cli/generation/configurations/general/docs.ts';
import { buildHtmlSettings } from '#cli/generation/config-files/html-validate.ts';
import { buildSqlfluffFile } from '#cli/generation/configurations/language/sql.ts';
import { buildTyposFile } from '#cli/generation/configurations/general/spelling.ts';
import { buildStylelintFile } from '#cli/generation/configurations/language/css.ts';
import { buildPurgecssFile } from '#cli/generation/configurations/framework/site.ts';
import { buildShellcheckFile } from '#cli/generation/configurations/language/bash.ts';
import { buildPrettierignoreFile } from '#cli/generation/config-files/ignore-files.ts';
import { buildJscpdFile } from '#cli/generation/configurations/general/duplication.ts';
import { buildGixyFile } from '#cli/generation/configurations/infrastructure/nginx.ts';
import { buildCommitlintFile } from '#cli/generation/configurations/general/commits.ts';
import { buildKnipFile } from '#cli/generation/configurations/language/javascript/knip.ts';
import { buildMarkdownlintFile } from '#cli/generation/configurations/language/markdown.ts';
import { buildOsvScannerFile } from '#cli/generation/configurations/general/dependencies.ts';
import { buildSpectralFile } from '#cli/generation/configurations/infrastructure/openapi.ts';
import { buildAnsibleLintFile } from '#cli/generation/configurations/infrastructure/ansible.ts';
import { buildPeripheryFile } from '#cli/generation/configurations/language/swift/periphery.ts';
import { buildSwiftlintFile } from '#cli/generation/configurations/language/swift/swiftlint.ts';
import { buildJsconfigFile } from '#cli/generation/configurations/language/javascript/jsconfig.ts';
import { buildSwiftformatFile } from '#cli/generation/configurations/language/swift/swiftformat.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/generation/configurations/language/python.ts';
import { buildEslintFile } from '#cli/generation/configurations/language/javascript/eslint/config-file.ts';
import { buildPrettierFile, buildEditorconfigFile } from '#cli/generation/configurations/general/format.ts';
import { buildTrivyFile, buildHadolintFile } from '#cli/generation/configurations/infrastructure/docker.ts';
import { buildV8rFile, buildTaploFile, buildYamllintFile } from '#cli/generation/configurations/general/data-files.ts';

import {
    TRANSPILE_OPTIONS,
    CONFIG_FILE_REFERENCE,
    SEMGREP_RULE_PACK_FILE,
} from '#cli/config/generation/config-files/build.ts';
import {
    type BuiltConfigFile,
    type PlannedConfigFile,
    type ConfigFileBuilder,
    type ConfigFileGeneration,
} from '#cli/types/generation/files.ts';
import {
    buildValeIniFile,
    buildLengthStyle,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildAcceptedWordsFile,
    buildCapitalizationStyle,
    buildBannedHeadingsStyle,
} from '#cli/generation/configurations/general/prose.ts';

const CONFIG_FILE_BUILDERS: Readonly<Record<string, ConfigFileBuilder | undefined>> = {
    'ansible/ansible-lint.yml': buildAnsibleLintFile,
    'prose/styles/gspot/acronyms.yml': buildAcronymsStyle,
    'nginx/gixy.cfg': buildGixyFile,
    'postgres/squawk.toml': buildSquawkFile,
    'docker/trivy.yml': buildTrivyFile,
    'bash/shellcheckrc': buildShellcheckFile,
    'commits/commitlint.json': buildCommitlintFile,
    'markdown/markdownlint.jsonc': buildMarkdownlintFile,
    'duplication/jscpd.json': buildJscpdFile,
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
    'prose/styles/gspot/heading-case.yml': (planned) => buildCapitalizationStyle(planned, 'heading'),
    'prose/styles/gspot/paragraph-length.yml': (planned) => buildLengthStyle(planned, 'paragraph'),
    'prose/styles/gspot/alt-text.yml': buildAltTextStyle,
    'prose/styles/gspot/banned-headings.yml': buildBannedHeadingsStyle,
    'prose/styles/gspot/sentence-length.yml': (planned) => buildLengthStyle(planned, 'sentence'),
    'prose/styles/gspot/title-case.yml': (planned) => buildCapitalizationStyle(planned, 'title'),
    'prose/styles/gspot/item-length.yml': (planned) => buildLengthStyle(planned, 'item'),
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
Build the text of one config file, and of the files that it imports.

@param planned the config file with its scope, level, and target path.
@param targets the config file path for each scope.
@returns the generated file, with paths relative to where it sits, and its companion files.
*/
export function buildConfigFile(
    planned: PlannedConfigFile,
    targets: ConfigFileGeneration['targets'],
): Pick<BuiltConfigFile, 'file' | 'companions'> {
    const { configFile, targetPath } = planned;
    const builder =
        configFile.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : CONFIG_FILE_BUILDERS[`${planned.configuration.name}/${configFile.file}`];
    let built: ReturnType<ConfigFileBuilder>;
    if (builder === undefined) {
        const source = configFile.source;
        const shipped = readFileSync(buildAssetPath(`${planned.configuration.folder}/${source}`), 'utf8');
        built = source.endsWith('.ts')
            ? ts.transpileModule(shipped, { compilerOptions: TRANSPILE_OPTIONS }).outputText
            : shipped;
    } else built = builder(planned);
    const { content, companions } = typeof built === 'string' ? { content: built, companions: [] } : built;
    const source = content.replaceAll(CONFIG_FILE_REFERENCE, (match: string, path: string) => {
        const referenced = join(dirname(configFile.target), path);
        const mapped = targets.get(planned.scope.folder.path)?.get(referenced);
        return mapped === undefined ? match : match.replace(path, () => relative(dirname(targetPath), mapped));
    });
    return {
        file: { path: targetPath, content: `${formatHeader(targetPath)}${source.trimEnd()}\n` },
        companions: companions.map((companion) => ({
            path: companion.path,
            content: `${formatHeader(companion.path)}${companion.content.trimEnd()}\n`,
        })),
    };
}
