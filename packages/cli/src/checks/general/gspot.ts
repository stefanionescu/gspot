import { type Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { generate } from '#cli/generation/generate.ts';
import { findSettingLine } from '#cli/settings/file.ts';
import { mapSettingPaths } from '#cli/settings/paths.ts';
import { listOutdatedFiles } from '#cli/apply/outdated.ts';
import { getToolName } from '#cli/configurations/tools.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { TOOL_LOCKFILES } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { groupFilesByScope } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { listGeneratedPaths } from '#cli/repository/files/classify.ts';
import { isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import type { SourceComment } from '#cli/types/parsers/code/comments.ts';
import { type Finding, type FindingPlace } from '#cli/types/runs/check.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import type { SuppressionSyntax } from '#cli/types/checks/general/gspot.ts';
import { listConflictingConfigFiles } from '#cli/repository/config-files.ts';
import { parseComments, stripCommentEnd } from '#cli/parsers/code/comments.ts';
import { type Scope, type PathVisitor } from '#cli/types/settings/inheritance.ts';

import {
    GROUP_HELP,
    REASON_ABOVE,
    UNESCAPED_GROUP,
    NEGATED_PATTERN,
    ISO_DATE_LENGTH,
    EXPIRED_IGNORE_HELP,
    GENERATED_FILE_FINDINGS,
    SUPPRESSION_KIND_MESSAGES,
} from '#cli/config/checks/general/gspot.ts';

/**
Reports each settings file of a tool that gspot writes settings for, such as .commitlintrc.json while commitlint
runs. A level change or a new configuration can make gspot take over a tool after init ran.

@param session the repository and the tools that the selected checks run.
@param planned the repository-wide check.
@returns one finding per conflicting config file.
*/
export function checkGspotConflictingConfigFiles(session: Session, planned: PlannedCheck): Finding[] {
    const tools = new Set(
        session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
    );
    const generated = listGeneratedPaths(session.repository.files);
    return listConflictingConfigFiles(session.root, session.repository.files, session.configurations.values())
        .filter(({ tool, path, shared }) => !shared && tools.has(tool) && !generated.has(path))
        .map(({ tool, path }) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'conflicting-config-file',
                `gspot writes the settings for ${tool}, so ${path} no longer applies. Delete it, and move any rule you need into gspot.toml.`,
            ),
        );
}

/**
Reports each generated file on disk that does not match what the settings generate.

@param session the settings and repository.
@param planned the repository-wide drift check.
@returns one finding per file that differs.
*/
export async function checkGspotGeneratedFiles(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const outdated = await listOutdatedFiles(session, generate(session));
    return outdated.map((outdatedFile) =>
        buildFinding(
            planned,
            { file: outdatedFile.path },
            outdatedFile.kind,
            GENERATED_FILE_FINDINGS[outdatedFile.kind].message,
            {
                help: TOOL_LOCKFILES.has(outdatedFile.path)
                    ? 'Run gspot install.'
                    : GENERATED_FILE_FINDINGS[outdatedFile.kind].help,
            },
        ),
    );
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

function listSuppressionSyntaxes(scope: Scope): SuppressionSyntax[] {
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
            covers: (file: TrackedFile) =>
                readers.some(
                    ({ files }) =>
                        listCoveredFiles(files, [file], {
                            configurations: scope.configurations,
                            scopePath: scope.folder.path,
                            settings: scope.settings,
                        }).length > 0,
                ),
            marker: new RegExp(definition.marker, 'u'),
            inlineMarker: new RegExp(definition.inline_marker ?? definition.marker, 'u'),
            readReason: (text: string) => reason.exec(text)?.groups?.['reason']?.trim(),
            forbidden: definition.forbidden === true,
            separator: definition.separator === undefined ? undefined : new RegExp(definition.separator, 'u'),
            allRules: definition.all_rules === undefined ? undefined : new RegExp(definition.all_rules, 'u'),
            limitRules: definition.limit_rules === undefined ? undefined : new RegExp(definition.limit_rules, 'u'),
        };
    });
}

function parseSuppressionRules(form: SuppressionSyntax, text: string): string | undefined {
    if (form.separator === undefined) return undefined;
    const suppression = form.marker.exec(text);
    return suppression === null ? undefined : (suppression.groups?.['rules'] ?? '').split(form.separator)[0];
}

function classifySuppression(
    form: SuppressionSyntax,
    text: string,
    preceding: string | undefined,
): keyof typeof SUPPRESSION_KIND_MESSAGES | 'no-reason' | undefined {
    const rules = parseSuppressionRules(form, text);
    if (rules !== undefined) {
        if (form.allRules?.test(rules.trim()) === true) return 'all';
        if (form.limitRules?.test(rules) === true) return 'limit';
    }
    return isReasonAccepted(form.readReason(text) ?? preceding) ? undefined : 'no-reason';
}

function checkSuppressionComment(
    planned: PlannedCheck,
    form: SuppressionSyntax,
    comment: SourceComment & FindingPlace,
    preceding: string | undefined,
): Finding[] {
    const text = stripCommentEnd(comment.text);
    const marker = comment.standalone ? form.marker : form.inlineMarker;
    if (!marker.test(text)) return [];
    const at = { file: comment.file, line: comment.line };
    if (form.forbidden)
        return [
            buildFinding(
                planned,
                at,
                form.tool,
                `${form.tool} suppression is not allowed; fix the finding or configure an explicit ignore.`,
            ),
        ];
    const kind = classifySuppression(form, text, preceding);
    if (kind === undefined) return [];
    const message =
        kind === 'no-reason'
            ? `This ${form.tool} suppression has no reason of two or more words.`
            : SUPPRESSION_KIND_MESSAGES[kind];
    return [buildFinding(planned, at, `${form.tool}-${kind}`, message)];
}

function listExpiredIgnores(session: Session, planned: PlannedCheck): Finding[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return session.settingsFile.settings.ignore.flatMap((ignore, index) => {
        const date = ignore.until?.toISOString();
        if (date === undefined || today < date) return [];
        return [
            buildFinding(
                planned,
                { file: SETTINGS_FILE, line: findSettingLine(session.settingsFile, ['ignore', index]) },
                'expired-ignore',
                `This ignore of ${ignore.check ?? 'every check'} ended on ${date}.`,
                { help: EXPIRED_IGNORE_HELP },
            ),
        ];
    });
}

/**
Reports forbidden suppressions, suppressions that turn off every rule or a size limit, suppressions without a
reason, and ignores past their until date.

@param session the repository and its tools.
@param planned the files to scan, by scope.
@returns the findings.
*/
export async function checkGspotSuppressions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const filesByScope = groupFilesByScope(
        planned.files.filter((file) => file.kind === 'source' && file.tags.includes('text')),
        session.scopes.map((scope) => scope.folder),
    );
    const found: Finding[] = listExpiredIgnores(session, planned);
    for (const scope of session.scopes) {
        const syntaxes = listSuppressionSyntaxes(scope);
        for (const file of filesByScope.get(scope.folder.path) ?? []) {
            const forms = syntaxes.filter((form) => form.covers(file));
            const source = readCachedText(session.reads, file.path);
            const comments = await parseComments(file.path, source, file.tags);
            found.push(
                ...comments.flatMap((comment, index) => {
                    const preceding = findReasonAbove(comments[index - 1], comment);
                    return forms.flatMap((form) =>
                        checkSuppressionComment(planned, form, { ...comment, file: file.path }, preceding),
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
@param planned the settings and tracked files.
@returns the findings.
*/
export function checkGspotUnmatchedPaths(session: Session, planned: PlannedCheck): Finding[] {
    const files = session.repository.files;
    const repositoryPaths = [...includeParentFolders(files.map((file) => file.path))];
    return listSettingsTables(session.settingsFile.settings).flatMap(({ table, scope = '', path }) => {
        const findings: Finding[] = [];
        const schema = scope === '' ? settingsSchema : scopeSchema;
        const visit: PathVisitor = (pattern, keys, role) => {
            const matches = buildPathMatcher([pattern.replace(NEGATED_PATTERN, '')]);
            if (role === 'source' && repositoryPaths.every((repositoryPath) => !matches(repositoryPath))) {
                const names = keys
                    .filter((field): field is string => typeof field === 'string')
                    .filter((field, index, fields) => field !== 'paths' || index !== fields.length - 1);
                const key = [...path, ...names].join('.');
                const written = getValueAt(table.written, names);
                const where =
                    Array.isArray(written) && written.some((element) => isTable(element)) ? `[[${key}]]` : key;
                findings.push(
                    buildFinding(
                        planned,
                        {
                            file: SETTINGS_FILE,
                            line: findSettingLine(session.settingsFile, [...path, ...keys]),
                        },
                        'unmatched-path',
                        `${pattern} under ${where} matches no tracked file or folder.${UNESCAPED_GROUP.test(pattern) ? GROUP_HELP : ''}`,
                    ),
                );
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
