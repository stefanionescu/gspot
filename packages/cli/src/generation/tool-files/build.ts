import { readAsset } from '#cli/system/assets.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { JSON_EXTENSIONS } from '#cli/config/generation/header.ts';
import { jsonText, formatHeader } from '#cli/generation/header.ts';
import { buildKnipFile } from '#cli/generation/tool-files/knip.ts';
import { listPrettierPlugins } from '#cli/planning/needed-tools.ts';
import { buildJscpdFile } from '#cli/generation/tool-files/jscpd.ts';
import { buildTyposFile } from '#cli/generation/tool-files/typos.ts';
import { buildJsconfig } from '#cli/generation/tool-files/jsconfig.ts';
import { buildSquawkFile } from '#cli/generation/tool-files/squawk.ts';
import { buildHadolintFile } from '#cli/generation/tool-files/hadolint.ts';
import { buildSqlfluffFile } from '#cli/generation/tool-files/sqlfluff.ts';
import { buildYamllintFile } from '#cli/generation/tool-files/yamllint.ts';
import { buildStylelintFile } from '#cli/generation/tool-files/stylelint.ts';
import { buildSwiftlintFile } from '#cli/generation/tool-files/swiftlint.ts';
import { eslintConfiguration } from '#cli/generation/eslint/configuration.ts';
import { buildPrettierOptions } from '#cli/generation/tool-files/prettier.ts';
import { buildCommitlintFile } from '#cli/generation/tool-files/commitlint.ts';
import { buildShellcheckFile } from '#cli/generation/tool-files/shellcheck.ts';
import { buildSwiftformatFile } from '#cli/generation/tool-files/swiftformat.ts';
import { buildMarkdownlintFile } from '#cli/generation/tool-files/markdownlint.ts';
import { buildHtmlValidateFile } from '#cli/generation/tool-files/html-validate.ts';
import type { ToolFileBuilder, GenerationInputs } from '#cli/types/generation/files.ts';
import { buildRuffFile, buildBasedpyrightFile } from '#cli/generation/tool-files/python.ts';
import { buildSemgrepFile, buildSemgrepignore } from '#cli/generation/tool-files/semgrep.ts';
import { SEMGREP_CONFIGURATION_COMPONENT } from '#cli/config/generation/tool-file-sources.ts';
import { buildEditorconfigFile, editorconfigOverrides } from '#cli/generation/tool-files/editorconfig.ts';
import { generatedIgnores, gitignorePatterns, buildPrettierignore } from '#cli/generation/ignore-files.ts';

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
    titleCaseStyle,
    buildProseInputs,
    buildValeIniFile,
    headingCaseStyle,
    buildAltTextStyle,
    buildAcronymsStyle,
    buildListItemStyle,
    buildPossessivesStyle,
    buildAcceptedWordsFile,
    buildBannedHeadingsStyle,
    buildSentenceLengthStyle,
    buildParagraphLengthStyle,
} from '#cli/generation/tool-files/vale.ts';

const builders: Record<string, ToolFileBuilder | undefined> = {
    'ansible-lint.yml': ({ selection }) => buildAnsibleLintFile(selection.view),
    'acronyms.yml': ({ session, manifests }) =>
        buildAcronymsStyle({
            prose: buildProseInputs(session, manifests),
        }),
    'gixy.cfg': ({ selection }) => buildGixyFile(selection.view),
    'squawk.toml': ({ session, selection, files }) =>
        buildSquawkFile({ selection, files, settingsFile: session.settingsFile }),
    'trivy.yml': ({ selection }) => buildTrivyFile(selection.view),
    shellcheckrc: ({ session, selection }) => buildShellcheckFile(selection.view, session.settingsFile.settings.level),
    'commitlint.config.cjs': ({ selection, scopes }) => buildCommitlintFile({ selection, scopes }),
    'markdownlint.jsonc': ({ session, selection }) =>
        buildMarkdownlintFile(selection.view, session.settingsFile.settings.level),
    'jscpd.json': ({ selection }) => buildJscpdFile(selection.view),
    'taplo.toml': ({ selection }) => buildTaploFile(selection.view),
    'lychee.toml': ({ selection }) => buildLycheeFile(selection.view),
    'hadolint.yml': ({ session, selection }) => buildHadolintFile(selection.view, session.settingsFile.settings.level),
    'spectral.yaml': ({ session }) =>
        buildSpectralFile({
            isAll: session.settingsFile.settings.level === 'all',
        }),
    'v8r.yml': ({ selection }) => buildV8rFile(selection.view),
    'yamllint.yml': ({ selection }) => buildYamllintFile(selection.view),
    'osv-scanner.toml': ({ selection }) => buildOsvScannerFile(selection.view),
    'purgecss.config.mjs': ({ selection }) => buildPurgecssFile(selection.view),
    'html-validate-built.json': ({ session, selection, targetPath }) =>
        buildHtmlValidateFile(selection.view, { level: session.settingsFile.settings.level, targetPath }),
    semgrepignore: ({ session, selection, scopes }) =>
        buildSemgrepignore({
            selection,
            scopes,
            root: session.root,
            reads: session.reads,
            repository: session.repository,
        }),
    prettierignore: ({ session, selection }) =>
        buildPrettierignore({
            ignoresFor: selection.view.ignoresFor,
            ignoredPaths: gitignorePatterns(session),
        }),
    editorconfig: ({ session, selection }) =>
        buildEditorconfigFile({
            format: selection.view.format,
            extra: selection.view.extra,
            editorconfigOverrides: () => editorconfigOverrides(session.settingsFile.settings),
        }),
    'accept.txt': ({ session, manifests }) =>
        buildAcceptedWordsFile({
            prose: buildProseInputs(session, manifests),
        }),
    'vale.ini': ({ session, manifests, targetPath }) =>
        buildValeIniFile({
            targetPath,
            isAll: session.settingsFile.settings.level === 'all',
            prose: buildProseInputs(session, manifests),
        }),
    'heading-case.yml': ({ session, manifests }) =>
        headingCaseStyle({
            prose: buildProseInputs(session, manifests),
        }),
    'paragraph-length.yml': ({ selection }) => buildParagraphLengthStyle(selection.view),
    'alt-text.yml': ({ session }) =>
        buildAltTextStyle({
            isAll: session.settingsFile.settings.level === 'all',
        }),
    'banned-headings.yml': ({ selection }) => buildBannedHeadingsStyle(selection.view),
    'sentence-length.yml': ({ selection }) => buildSentenceLengthStyle(selection.view),
    'title-case.yml': ({ session, manifests }) =>
        titleCaseStyle({
            prose: buildProseInputs(session, manifests),
        }),
    'item-length.yml': ({ selection }) => buildListItemStyle(selection.view),
    'possessives.yml': ({ session }) =>
        buildPossessivesStyle({
            names: [
                ...new Set(
                    session.scopes.flatMap(({ selected }) =>
                        selected.flatMap((manifest) => [
                            ...manifest.tools.map((tool) => tool.name),
                            ...manifest.allowed_words,
                        ]),
                    ),
                ),
            ],
        }),
    'typos.toml': ({ session, selection, scopes }) =>
        buildTyposFile({
            selection,
            scopes,
            root: session.root,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'basedpyrightconfig.json': ({ session, selection, scopes }) =>
        buildBasedpyrightFile({
            selection,
            scopes,
            root: session.root,
            installedRoot: session.installedRoot,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'ruff.toml': ({ session, selection, scopes }) =>
        buildRuffFile({
            selection,
            scopes,
            root: session.root,
            installedRoot: session.installedRoot,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'stylelint.json': ({ session, selection }) =>
        buildStylelintFile(
            { selection, packageManifests: session.packageManifests },
            session.settingsFile.settings.level,
        ),
    'html-validate-source.json': ({ session, selection, targetPath }) =>
        buildHtmlValidateFile(selection.view, { level: session.settingsFile.settings.level, targetPath }),
    'periphery.yml': ({ selection }) => buildPeripheryFile(selection.view),
    swiftformat: ({ session, selection }) =>
        buildSwiftformatFile(
            { selection, root: session.root, reads: session.reads },
            session.settingsFile.settings.level,
        ),
    'swiftlint.yml': ({ session, selection }) =>
        buildSwiftlintFile(selection.view, session.settingsFile.settings.level),
    'knip.json': ({ session, selection, scopes, files, manifests }) =>
        buildKnipFile({
            selection,
            scopes,
            files,
            manifests,
            root: session.root,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
            startRunner: session.startRunner,
        }),
    'sqlfluff.cfg': ({ session, selection }) => buildSqlfluffFile(selection.view, session.settingsFile.settings.level),
    'eslint.config.mjs': ({ session, selection }) => eslintConfiguration({ session, selection }),
    'jsconfig.json': ({ session, selection, targetPath }) =>
        JSON.stringify(
            buildJsconfig({
                root: session.root,
                reads: session.reads,
                files: session.repository.files,
                scopeEntries: session.scopes.map((entry) => entry.scope),
                scope: selection.scope.path,
                declarationPaths: generatedIgnores(session),
                importStyle: selection.view.options('tools.eslint').import_extension,
                target: targetPath,
            }),
        ),
    'prettier.json': ({ session, selection, targetPath }) =>
        JSON.stringify(
            buildPrettierOptions({
                settings: session.settingsFile.settings,
                format: selection.view.format,
                extra: selection.view.extra('prettier'),
                plugins: [...listPrettierPlugins(session.scopes.flatMap(({ selected }) => selected)).values()],
                targetPath,
            }),
        ),
};

/**
 * Write a target through its declared builder.
 *
 * @param sourcePath the shipped file path.
 * @param targetPath the generated destination path.
 * @param context the repository and selected scope.
 *
 * @returns the generated configuration text.
 */
export function emitTarget(sourcePath: string, targetPath: string, context: GenerationInputs): string {
    const { session, selection } = context;

    const builder = builders[targetPath.slice(targetPath.lastIndexOf('/') + 1).replace(/^\./u, '')];
    const source = builder === undefined ? readAsset(sourcePath) : builder({ ...context, targetPath });
    let emitted = source;
    if (sourcePath.includes('/semgrep/'))
        emitted = buildSemgrepFile(emitted, sourcePath.split('/').at(SEMGREP_CONFIGURATION_COMPONENT) ?? '', {
            selection,
            scopes: context.scopes,
            packageManifests: session.packageManifests,
        });
    if (builder === undefined && !sourcePath.includes('/semgrep/')) return `${formatHeader(targetPath)}${emitted}`;
    if (JSON_EXTENSIONS.has(extractExtension(targetPath)))
        return jsonText(JSON.parse(emitted), {
            width: selection.view.format.print_width,
            indent: selection.view.format.indent_width,
        });
    return `${formatHeader(targetPath)}${emitted.trimEnd()}\n`;
}
