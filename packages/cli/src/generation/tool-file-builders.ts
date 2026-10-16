import { readAsset } from '#cli/system/assets.ts';
import { extensionOf } from '#cli/system/paths.ts';
import { buildJsconfig } from '#cli/generation/jsconfig.ts';
import { prettierPlugins } from '#cli/planning/needed-tools.ts';
import { jsonText, headerFor } from '#cli/generation/headers.ts';
import { JSON_EXTENSIONS } from '#cli/config/generation/headers.ts';
import { v8rToolFile } from '#cli/generation/tool-file-sources/v8r.ts';
import { gixyToolFile } from '#cli/generation/tool-file-sources/gixy.ts';
import { knipToolFile } from '#cli/generation/tool-file-sources/knip.ts';
import { ruffToolFile } from '#cli/generation/tool-file-sources/ruff.ts';
import { jscpdToolFile } from '#cli/generation/tool-file-sources/jscpd.ts';
import { taploToolFile } from '#cli/generation/tool-file-sources/taplo.ts';
import { trivyToolFile } from '#cli/generation/tool-file-sources/trivy.ts';
import { typosToolFile } from '#cli/generation/tool-file-sources/typos.ts';
import { lycheeToolFile } from '#cli/generation/tool-file-sources/lychee.ts';
import { squawkToolFile } from '#cli/generation/tool-file-sources/squawk.ts';
import { eslintConfiguration } from '#cli/generation/eslint/configuration.ts';
import { hadolintToolFile } from '#cli/generation/tool-file-sources/hadolint.ts';
import { purgecssToolFile } from '#cli/generation/tool-file-sources/purgecss.ts';
import { spectralToolFile } from '#cli/generation/tool-file-sources/spectral.ts';
import { sqlfluffToolFile } from '#cli/generation/tool-file-sources/sqlfluff.ts';
import { yamllintToolFile } from '#cli/generation/tool-file-sources/yamllint.ts';
import type { EmitInputs, ToolFileBuilder } from '#cli/types/generation/files.ts';
import { peripheryToolFile } from '#cli/generation/tool-file-sources/periphery.ts';
import { stylelintToolFile } from '#cli/generation/tool-file-sources/stylelint.ts';
import { swiftlintToolFile } from '#cli/generation/tool-file-sources/swiftlint.ts';
import { commitlintToolFile } from '#cli/generation/tool-file-sources/commitlint.ts';
import { shellcheckToolFile } from '#cli/generation/tool-file-sources/shellcheck.ts';
import { osvScannerToolFile } from '#cli/generation/tool-file-sources/osv-scanner.ts';
import { swiftformatToolFile } from '#cli/generation/tool-file-sources/swiftformat.ts';
import { ansibleLintToolFile } from '#cli/generation/tool-file-sources/ansible-lint.ts';
import { generatedIgnores, gitignorePatterns } from '#cli/generation/ignore-patterns.ts';
import { basedpyrightToolFile } from '#cli/generation/tool-file-sources/basedpyright.ts';
import { markdownlintToolFile } from '#cli/generation/tool-file-sources/markdownlint.ts';
import { htmlValidateToolFile } from '#cli/generation/tool-file-sources/html-validate.ts';
import { SEMGREP_CONFIGURATION_COMPONENT } from '#cli/config/generation/tool-file-sources.ts';
import { semgrepToolFile, semgrepignoreToolFile } from '#cli/generation/tool-file-sources/semgrep.ts';

import {
    editorconfigToolFile,
    editorconfigOverrides,
    prettierConfiguration,
    prettierignoreToolFile,
} from '#cli/generation/formatting.ts';
import {
    proseInputs,
    altTextStyle,
    acronymsStyle,
    titleCaseStyle,
    itemLengthStyle,
    valeIniToolFile,
    headingCaseStyle,
    possessivesStyle,
    bannedHeadingsStyle,
    sentenceLengthStyle,
    paragraphLengthStyle,
    acceptedWordsToolFile,
} from '#cli/generation/prose.ts';

const builders: Record<string, ToolFileBuilder | undefined> = {
    'ansible-lint.yml': ({ selection }) => ansibleLintToolFile(selection.view),
    'acronyms.yml': ({ session, manifests }) =>
        acronymsStyle({
            prose: proseInputs(session, manifests),
        }),
    'gixy.cfg': ({ selection }) => gixyToolFile(selection.view),
    'squawk.toml': ({ session, selection, files }) =>
        squawkToolFile({ selection, files, settingsFile: session.settingsFile }),
    'trivy.yml': ({ selection }) => trivyToolFile(selection.view),
    shellcheckrc: ({ session, selection }) => shellcheckToolFile(selection.view, session.settingsFile.settings.level),
    'commitlint.config.cjs': ({ selection, scopes }) => commitlintToolFile({ selection, scopes }),
    'markdownlint.jsonc': ({ session, selection }) =>
        markdownlintToolFile(selection.view, session.settingsFile.settings.level),
    'jscpd.json': ({ selection }) => jscpdToolFile(selection.view),
    'taplo.toml': ({ selection }) => taploToolFile(selection.view),
    'lychee.toml': ({ selection }) => lycheeToolFile(selection.view),
    'hadolint.yml': ({ session, selection }) => hadolintToolFile(selection.view, session.settingsFile.settings.level),
    'spectral.yaml': ({ session }) =>
        spectralToolFile({
            isAll: session.settingsFile.settings.level === 'all',
        }),
    'v8r.yml': ({ selection }) => v8rToolFile(selection.view),
    'yamllint.yml': ({ selection }) => yamllintToolFile(selection.view),
    'osv-scanner.toml': ({ selection }) => osvScannerToolFile(selection.view),
    'purgecss.config.mjs': ({ selection }) => purgecssToolFile(selection.view),
    'html-validate-built.json': ({ session, selection, targetPath }) =>
        htmlValidateToolFile(selection.view, { level: session.settingsFile.settings.level, targetPath }),
    semgrepignore: ({ session, selection, scopes }) =>
        semgrepignoreToolFile({
            selection,
            scopes,
            root: session.root,
            reads: session.reads,
            repository: session.repository,
        }),
    prettierignore: ({ session, selection }) =>
        prettierignoreToolFile({
            ignoresFor: selection.view.ignoresFor,
            ignoredPaths: gitignorePatterns(session),
        }),
    editorconfig: ({ session, selection }) =>
        editorconfigToolFile({
            format: selection.view.format,
            extra: selection.view.extra,
            editorconfigOverrides: () => editorconfigOverrides(session.settingsFile.settings),
        }),
    'accept.txt': ({ session, manifests }) =>
        acceptedWordsToolFile({
            prose: proseInputs(session, manifests),
        }),
    'vale.ini': ({ session, manifests, targetPath }) =>
        valeIniToolFile({
            targetPath,
            isAll: session.settingsFile.settings.level === 'all',
            prose: proseInputs(session, manifests),
        }),
    'heading-case.yml': ({ session, manifests }) =>
        headingCaseStyle({
            prose: proseInputs(session, manifests),
        }),
    'paragraph-length.yml': ({ selection }) => paragraphLengthStyle(selection.view),
    'alt-text.yml': ({ session }) =>
        altTextStyle({
            isAll: session.settingsFile.settings.level === 'all',
        }),
    'banned-headings.yml': ({ selection }) => bannedHeadingsStyle(selection.view),
    'sentence-length.yml': ({ selection }) => sentenceLengthStyle(selection.view),
    'title-case.yml': ({ session, manifests }) =>
        titleCaseStyle({
            prose: proseInputs(session, manifests),
        }),
    'item-length.yml': ({ selection }) => itemLengthStyle(selection.view),
    'possessives.yml': ({ session }) =>
        possessivesStyle({
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
        typosToolFile({
            selection,
            scopes,
            root: session.root,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'basedpyrightconfig.json': ({ session, selection, scopes }) =>
        basedpyrightToolFile({
            selection,
            scopes,
            root: session.root,
            installedRoot: session.installedRoot,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'ruff.toml': ({ session, selection, scopes }) =>
        ruffToolFile({
            selection,
            scopes,
            root: session.root,
            installedRoot: session.installedRoot,
            settingsFile: session.settingsFile,
            reads: session.reads,
            repository: session.repository,
        }),
    'stylelint.json': ({ session, selection }) =>
        stylelintToolFile(
            { selection, packageManifests: session.packageManifests },
            session.settingsFile.settings.level,
        ),
    'html-validate-source.json': ({ session, selection, targetPath }) =>
        htmlValidateToolFile(selection.view, { level: session.settingsFile.settings.level, targetPath }),
    'periphery.yml': ({ selection }) => peripheryToolFile(selection.view),
    swiftformat: ({ session, selection }) =>
        swiftformatToolFile(
            { selection, root: session.root, reads: session.reads },
            session.settingsFile.settings.level,
        ),
    'swiftlint.yml': ({ session, selection }) => swiftlintToolFile(selection.view, session.settingsFile.settings.level),
    'knip.json': ({ session, selection, scopes, files, manifests }) =>
        knipToolFile({
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
    'sqlfluff.cfg': ({ session, selection }) => sqlfluffToolFile(selection.view, session.settingsFile.settings.level),
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
            prettierConfiguration({
                settings: session.settingsFile.settings,
                format: selection.view.format,
                extra: selection.view.extra('prettier'),
                plugins: [...prettierPlugins(session.scopes.flatMap(({ selected }) => selected)).values()],
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
export function emitTarget(sourcePath: string, targetPath: string, context: EmitInputs): string {
    const { session, selection } = context;

    const builder = builders[targetPath.slice(targetPath.lastIndexOf('/') + 1).replace(/^\./u, '')];
    const source = builder === undefined ? readAsset(sourcePath) : builder({ ...context, targetPath });
    let emitted = source;
    if (sourcePath.includes('/semgrep/'))
        emitted = semgrepToolFile(emitted, sourcePath.split('/').at(SEMGREP_CONFIGURATION_COMPONENT) ?? '', {
            selection,
            scopes: context.scopes,
            packageManifests: session.packageManifests,
        });
    if (builder === undefined && !sourcePath.includes('/semgrep/')) return `${headerFor(targetPath)}${emitted}`;
    if (JSON_EXTENSIONS.has(extensionOf(targetPath)))
        return jsonText(JSON.parse(emitted), {
            width: selection.view.format.print_width,
            indent: selection.view.format.indent_width,
        });
    return `${headerFor(targetPath)}${emitted.trimEnd()}\n`;
}
