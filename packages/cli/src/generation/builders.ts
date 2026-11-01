import { readFileSync } from 'node:fs';
import { buildAssetPath } from '#cli/system/assets.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { join, dirname, relative } from 'node:path/posix';
import { requireTypescript } from '#cli/system/typescript.ts';
import { buildLycheeFile } from '#cli/generation/configurations/general/docs.ts';
import { buildSqlfluffFile } from '#cli/generation/configurations/language/sql.ts';
import { buildTyposFile } from '#cli/generation/configurations/general/spelling.ts';
import { buildStylelintFile } from '#cli/generation/configurations/language/css.ts';
import { buildCoverageFile } from '#cli/generation/configurations/testing/pytest.ts';
import { buildSquawkFile } from '#cli/generation/configurations/database/postgres.ts';
import { buildSemgrepFile } from '#cli/generation/configurations/general/security.ts';
import { buildShellcheckFile } from '#cli/generation/configurations/language/bash.ts';
import { buildJscpdFile } from '#cli/generation/configurations/general/duplication.ts';
import { buildGixyFile } from '#cli/generation/configurations/infrastructure/nginx.ts';
import { buildCommitlintFile } from '#cli/generation/configurations/general/commits.ts';
import { buildHtmlValidateFile } from '#cli/generation/configurations/language/html.ts';
import { buildKnipFile } from '#cli/generation/configurations/language/javascript/knip.ts';
import { buildMarkdownlintFile } from '#cli/generation/configurations/language/markdown.ts';
import { buildPurgecssSafelistFile } from '#cli/generation/configurations/framework/site.ts';
import { buildOsvScannerFile } from '#cli/generation/configurations/general/dependencies.ts';
import { buildSpectralFile } from '#cli/generation/configurations/infrastructure/openapi.ts';
import { buildBiomeFile } from '#cli/generation/configurations/language/javascript/biome.ts';
import { buildAnsibleLintFile } from '#cli/generation/configurations/infrastructure/ansible.ts';
import { buildPeripheryFile } from '#cli/generation/configurations/language/swift/periphery.ts';
import { buildSwiftlintFile } from '#cli/generation/configurations/language/swift/swiftlint.ts';
import { buildJsconfigFile } from '#cli/generation/configurations/language/javascript/jsconfig.ts';
import { buildV8rFile, buildTaploFile } from '#cli/generation/configurations/general/data-files.ts';
import { buildSwiftformatFile } from '#cli/generation/configurations/language/swift/swiftformat.ts';
import { buildEslintFile } from '#cli/generation/configurations/language/javascript/eslint/config.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/generation/configurations/language/python.ts';
import { buildTrivyFile, buildHadolintFile } from '#cli/generation/configurations/infrastructure/docker.ts';
import { TS_EXTENSION, CONFIG_REFERENCE, SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/generation.ts';

import {
    buildPrettierFile,
    buildEditorconfigFile,
    buildPrettierignoreFile,
} from '#cli/generation/configurations/general/format.ts';
import {
    type BuiltConfig,
    type PlannedConfig,
    type ConfigBuilder,
    type OwnedSourceFile,
    type ConfigBuildState,
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
    'duplication/jscpd.json': buildJscpdFile,
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
    'html/html-validate.json': buildHtmlValidateFile,
    'swift/periphery.yml': buildPeripheryFile,
    'swift/swiftformat': buildSwiftformatFile,
    'swift/swiftlint.yml': buildSwiftlintFile,
    'javascript/knip.json': buildKnipFile,
    'javascript/biome.json': buildBiomeFile,
    'sql/sqlfluff.cfg': buildSqlfluffFile,
    'javascript/eslint/eslint.mjs': buildEslintFile,
    'javascript/jsconfig.json': buildJsconfigFile,
    'format/prettier.json': buildPrettierFile,
};

/**
Build the text of one config file, and of the files that it imports.

@param owned the config file and the scope that owns it.
@param targetPath the repository path where gspot writes the file.
@param generated the config paths and shared ignore sections.
@returns the generated file, with paths relative to where it sits, and its companion files.
*/
export function buildConfig(
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
    const builder =
        config.file === SEMGREP_RULE_PACK_FILE
            ? buildSemgrepFile
            : CONFIG_BUILDERS[`${planned.configuration.name}/${config.file}`];
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
    const source = content.replaceAll(CONFIG_REFERENCE, (match: string, path: string) => {
        const referenced = join(dirname(config.target), path);
        const mapped = generated.targets.get(planned.scope.path)?.get(referenced);
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
