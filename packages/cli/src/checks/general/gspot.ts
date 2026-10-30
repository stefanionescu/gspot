import { read } from '#cli/system/files/reads.ts';
import { type Session } from '#cli/types/session.ts';
import { getToolName } from '#cli/manifests/tools.ts';
import { mapSettingPaths } from '#cli/settings/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { TOOL_LOCKFILES } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { INSTALL_HELP } from '#cli/config/executables/inspect.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { findSettingLine, isReasonedValue } from '#cli/settings/file.ts';
import type { SourceComment } from '#cli/types/parsers/code/comments.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import type { SuppressionSyntax } from '#cli/types/checks/general/gspot.ts';
import { listConflictingConfigFiles } from '#cli/repository/config-files.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/code/comments.ts';
import { type CheckFinding, type FindingPlace } from '#cli/types/runs/check.ts';
import { type Scope, type PathVisitor } from '#cli/types/settings/inheritance.ts';

import {
    RULES,
    BRACKET_HELP,
    REASON_ABOVE,
    NEGATED_PATTERN,
    UNESCAPED_BRACKET,
    GENERATED_FILE_FINDINGS,
    SUPPRESSION_KIND_MESSAGES,
} from '#cli/config/checks/general/gspot.ts';

/**
Reports each settings file of a tool that gspot writes settings for, such as .commitlintrc.json while commitlint runs.

@param session the repository and the tools that the selected checks run.
@param _planned the configured check and selected scope files.
*/
export function checkGspotConflictingConfigFiles(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const tools = new Set(
        session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    );
    const generated = listGeneratedPaths(session.repository.files);
    return listConflictingConfigFiles(session.root, session.repository.files, session.configurationsByName.values())
        .filter(({ tool, path, shared }) => !shared && tools.has(tool) && !generated.has(path))
        .map(({ tool, path }) => ({
            file: path,
            line: 1,
            rule: RULES.conflictingConfigFile,
            message: `gspot writes the settings for ${tool}, so ${path} no longer applies. Delete it, and move any rule you need into gspot.toml.`,
        }));
}

/**
Reports each generated file on disk that does not match what the settings generate.

@param session the settings and repository.
@param _planned the configured check and selected scope files.
*/
export async function checkGspotGeneratedFiles(session: Session, _planned: PlannedCheck): Promise<CheckFinding[]> {
    const outdated = await listOutdatedFiles(session, generateFiles(session));
    return outdated.map((outdatedFile) => ({
        file: outdatedFile.path,
        rule: outdatedFile.kind,
        message: GENERATED_FILE_FINDINGS[outdatedFile.kind].message,

        help: TOOL_LOCKFILES.has(outdatedFile.path) ? INSTALL_HELP : GENERATED_FILE_FINDINGS[outdatedFile.kind].help,
    }));
}

function findReasonAbove(previous: SourceComment | undefined, comment: SourceComment): string | undefined {
    if (
        previous === undefined ||
        !previous.standalone ||
        previous.line + 1 !== comment.line ||
        previous.text.includes('\n')
    )
        return undefined;
    const text = stripCommentEnd(previous.text);
    return REASON_ABOVE.exec(text)?.groups?.['reason']?.trim();
}

function listSuppressionSyntaxes(scope: Scope, scopeFiles: TrackedFile[]): SuppressionSyntax[] {
    const checks = scope.configurations.flatMap((configuration) =>
        configuration.checks.map((check) => ({ check, files: check.files ?? configuration.files })),
    );
    const definitions = new Map(
        scope.configurations.flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
                tool.suppression === undefined ? [] : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
    return [...definitions].map(([tool, definition]) => {
        const readers = checks.filter(({ check }) => getToolName(check) === tool);
        const reason = new RegExp(definition.reason, 'u');
        return {
            tool,
            covered: new Set(
                readers.flatMap(({ files }) =>
                    listCoveredFiles(files, scopeFiles, {
                        configurations: scope.configurations,
                        scopePath: scope.path,
                        settings: scope.settings,
                    }).map((file) => file.path),
                ),
            ),
            marker: new RegExp(definition.marker, 'u'),
            inlineMarker: new RegExp(definition.inline_marker ?? definition.marker, 'u'),
            extractReason: (text: string) => reason.exec(text)?.groups?.['reason']?.trim(),
            forbidden: definition.forbidden === true,
            separator: definition.separator === undefined ? undefined : new RegExp(definition.separator, 'u'),
            allRules: definition.all_rules === undefined ? undefined : new RegExp(definition.all_rules, 'u'),
            limitRules: definition.limit_rules === undefined ? undefined : new RegExp(definition.limit_rules, 'u'),
        };
    });
}

function parseSuppressionRules(syntax: SuppressionSyntax, text: string): string | undefined {
    if (syntax.separator === undefined) return undefined;
    const suppression = syntax.marker.exec(text);
    return suppression === null ? undefined : (suppression.groups?.['rules'] ?? '').split(syntax.separator)[0];
}

function classifySuppression(
    syntax: SuppressionSyntax,
    text: string,
    preceding: string | undefined,
): keyof typeof SUPPRESSION_KIND_MESSAGES | 'no-reason' | undefined {
    const rules = parseSuppressionRules(syntax, text);
    if (rules !== undefined) {
        if (syntax.allRules?.test(rules.trim()) === true) return 'all';
        if (syntax.limitRules?.test(rules) === true) return 'limit';
    }
    return isReasonAccepted(syntax.extractReason(text) ?? preceding) ? undefined : 'no-reason';
}

function validateSuppressionComment(
    syntax: SuppressionSyntax,
    comment: SourceComment & FindingPlace,
    preceding: string | undefined,
): CheckFinding[] {
    const text = stripCommentEnd(comment.text);
    const marker = comment.standalone ? syntax.marker : syntax.inlineMarker;
    if (!marker.test(text)) return [];
    const at = { file: comment.file, line: comment.line };
    if (syntax.forbidden)
        return [
            {
                ...at,
                rule: syntax.tool,
                message: `${syntax.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
            },
        ];
    const kind = classifySuppression(syntax, text, preceding);
    if (kind === undefined) return [];
    const message =
        kind === 'no-reason'
            ? `This ${syntax.tool} suppression has no reason of two or more words.`
            : SUPPRESSION_KIND_MESSAGES[kind];
    return [{ ...at, rule: `${syntax.tool}-${kind}`, message: message }];
}

/**
Reports forbidden suppressions, suppressions that turn off every rule or a size limit, and suppressions without a
reason.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkGspotSuppressions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const filesByScope = Map.groupBy(
        planned.files.filter((file) => file.kind === 'source' && file.tags.includes('text')),
        (file) => selectScopePath(file.path, session.scopes),
    );
    const found: CheckFinding[] = [];
    for (const scope of session.scopes) {
        const files = filesByScope.get(scope.path) ?? [];
        const syntaxes = listSuppressionSyntaxes(scope, files);
        for (const file of files) {
            const forms = syntaxes.filter((form) => form.covered.has(file.path));
            const source = read(session.reads, file.path);
            const comments = await parseComments(file.path, source, file.tags);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = findReasonAbove(comments[index - 1], comment);
                    return forms.flatMap((form) =>
                        validateSuppressionComment(form, { ...comment, file: file.path }, preceding),
                    );
                }),
            );
        }
    }
    return found;
}

/**
Reports setting paths that match no tracked file or folder.

@param session the repository and its tools.
@param _planned the configured check and selected scope files.
*/
export function checkGspotUnmatchedPaths(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const files = session.repository.files;
    const repositoryPaths = [...includeParentFolders(files.map((file) => file.path))];
    return listSettingsTables(session.settings).flatMap(({ table, scope = '', path }) => {
        const findings: CheckFinding[] = [];
        const schema = scope === '' ? settingsSchema : scopeSchema;
        const visit: PathVisitor = (pattern, keys, role) => {
            const matches = buildPathMatcher([pattern.replace(NEGATED_PATTERN, '')]);
            if (role === 'source' && repositoryPaths.every((repositoryPath) => !matches(repositoryPath))) {
                const names = keys
                    .filter(
                        (field, index) =>
                            field !== 'value' || !isReasonedValue(getValueAt(table.written, keys.slice(0, index))),
                    )
                    .filter((field): field is string => typeof field === 'string')
                    .filter((field, index, fields) => field !== 'paths' || index !== fields.length - 1);
                const key = [...path, ...names].join('.');
                const written = getValueAt(table.written, names);
                const where =
                    Array.isArray(written) && written.some((element) => isTable(element)) ? `[[${key}]]` : key;
                findings.push({
                    file: SETTINGS_FILE,
                    line: findSettingLine(session.settingsText, session.settings.written, [...path, ...keys]),
                    rule: RULES.unmatchedPath,
                    message: `${pattern} under ${where} matches no tracked file or folder.${UNESCAPED_BRACKET.test(pattern) ? BRACKET_HELP : ''}`,
                });
            }
            return pattern;
        };
        const settings = Object.entries(table.written).filter(([key]) => key !== 'scope');
        mapSettingPaths(
            schema,
            Object.fromEntries([
                ...settings.filter(([key]) => key === 'ignore'),
                ...settings.filter(([key]) => key !== 'ignore'),
            ]),
            visit,
            [],
        );
        return findings;
    });
}
