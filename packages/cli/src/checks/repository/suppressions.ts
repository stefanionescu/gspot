import { readSource } from '#cli/repository/tracked.ts';
// Validate suppression comments against the repository reason policy; reporting owns the census.
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import type { EngineInput, Session } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { claimedByClaims } from '#cli/configurations/claims.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { COMMENT_OPENERS, COMMENT_STYLE_BY_EXTENSION } from '#cli/emit/markers.ts';

const GSPOT_SUPPRESSION = {
    marker: 'gspot-ignore +[a-z0-9-]+/[a-z0-9-]+',
    reason: ' -- (?<reason>\\S.*)',
};

export type SuppressionComment = { file: string; line: number; form: string; reason?: string; forbidden: boolean };

function styleOf(file: TrackedFile): string | undefined {
    const dot = file.path.lastIndexOf('.');
    return dot === -1 ? undefined : COMMENT_STYLE_BY_EXTENSION[file.path.slice(dot)];
}

// Whether an opener at this index sits inside a string literal: an odd count of a quote character before it.
function isQuoted(line: string, index: number): boolean {
    const before = line.slice(0, index);
    return ["'", '"', '`'].some((quote) => before.split(quote).length % 2 === 0);
}

// The comment part of a line: from the first comment opener outside a string literal on; code before it holds no directive.
function commentOf(line: string, style: string): string | undefined {
    const starts = (COMMENT_OPENERS[style] ?? [])
        .map((opener) => line.indexOf(opener))
        .filter((index) => index !== -1 && !isQuoted(line, index));
    return starts.length === 0 ? undefined : line.slice(Math.min(...starts));
}

/** Observe comments once through the selected tool definitions for each file scope. */
export function suppressionComments(session: Session, files: TrackedFile[]): SuppressionComment[] {
    return files.flatMap((file) => {
        const style = styleOf(file);
        if (style === undefined) return [];
        const scope = scopeOf(file.path, session.repository.scopes);
        const selected = session.scopes.find((selection) => selection.scope.path === scope.path)!.selected;
        const readers = new Set(
            selected.flatMap((manifest) =>
                manifest.checks.flatMap((check) =>
                    claimedByClaims(check.claims ?? manifest.claims, selected, [file], scope.path).length === 0
                        ? []
                        : [check.tool ?? check.command?.[0]],
                ),
            ),
        );
        const definitions = new Map(
            selected.flatMap((manifest) =>
                manifest.tools.flatMap((tool) =>
                    tool.suppression === undefined || !readers.has(tool.name)
                        ? []
                        : [[tool.name, tool.suppression] as const],
                ),
            ),
        );
        definitions.set('gspot-ignore', GSPOT_SUPPRESSION);
        const forms = [...definitions].map(([form, definition]) => ({
            form,
            marker: new RegExp(definition.marker, 'u'),
            reason: new RegExp(definition.reason, 'u'),
            forbidden: definition.forbidden === true,
        }));
        return readSource(session.root, file.path)
            .toString('utf8')
            .split('\n')
            .flatMap((line, index) => {
                const comment = commentOf(line, style);
                if (comment === undefined) return [];
                const text = comment.replace(/(?:\*\/|-->)\s*$/u, '').trimEnd();
                return forms.flatMap((form): SuppressionComment[] => {
                    if (!form.marker.test(text)) return [];
                    const reason = form.reason.exec(text)?.groups?.['reason']?.trim();
                    return [
                        {
                            file: file.path,
                            line: index + 1,
                            form: form.form,
                            forbidden: form.forbidden,
                            ...(reason === undefined ? {} : { reason }),
                        },
                    ];
                });
            });
    });
}

/** Report forbidden suppressions and missing or invalid required reasons. */
export function suppressions(input: EngineInput): Finding[] {
    if (input.suppressions === undefined) throw new Error('Suppression validation requires once-only execution.');
    const findings = input.suppressions.flatMap((entry): Finding[] => {
        const base = { check: input.spec.name, file: entry.file, line: entry.line, fixable: false };
        if (entry.forbidden)
            return [
                {
                    ...base,
                    rule: entry.form,
                    message: `${entry.form} suppression is not allowed; fix the finding or configure an explicit ignore.`,
                },
            ];
        if (!input.policyFiles.policy.requireReasons) return [];
        if (isReasonAccepted(entry.reason)) return [];
        return [
            {
                ...base,
                rule: `${entry.form}-no-reason`,
                message: `This ${entry.form} suppression needs a meaningful reason.`,
            },
        ];
    });
    return findings;
}
