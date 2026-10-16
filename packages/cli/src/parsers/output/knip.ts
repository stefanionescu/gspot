// Reads Knip issue categories and source locations.
import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import type { KnipReport, KnipSymbol } from '#cli/types/parsers/output.ts';
import { KNIP_ISSUE_MESSAGES, KNIP_ISSUE_CATEGORIES } from '#cli/config/parsers/output.ts';

const knipSymbolSchema = z.object({
    name: z.string().min(1),
    namespace: z.string().optional(),
    kind: z.string().optional(),
    specifier: z.string().optional(),
    line: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
    pos: z.number().int().nonnegative().optional(),
} satisfies SchemaShape<KnipSymbol>);

const knipReportSchema = z.strictObject({
    issues: z.array(
        z.strictObject({
            file: z.string().min(1),
            owners: z
                .array(
                    z.object({ name: z.string() } satisfies SchemaShape<
                        NonNullable<KnipReport['issues'][number]['owners']>[number]
                    >),
                )
                .optional(),
            binaries: z.array(knipSymbolSchema).optional(),
            catalog: z.array(knipSymbolSchema).optional(),
            catalogReferences: z.array(knipSymbolSchema).optional(),
            cycles: z.array(z.array(knipSymbolSchema).min(1)).optional(),
            dependencies: z.array(knipSymbolSchema).optional(),
            devDependencies: z.array(knipSymbolSchema).optional(),
            duplicates: z.array(z.array(knipSymbolSchema).min(1)).optional(),
            enumMembers: z.array(knipSymbolSchema).optional(),
            exports: z.array(knipSymbolSchema).optional(),
            files: z.array(knipSymbolSchema).optional(),
            namespaceMembers: z.array(knipSymbolSchema).optional(),
            nsExports: z.array(knipSymbolSchema).optional(),
            nsTypes: z.array(knipSymbolSchema).optional(),
            optionalPeerDependencies: z.array(knipSymbolSchema).optional(),
            types: z.array(knipSymbolSchema).optional(),
            unlisted: z.array(knipSymbolSchema).optional(),
            unresolved: z.array(knipSymbolSchema).optional(),
        } satisfies SchemaShape<KnipReport['issues'][number]>),
    ),
} satisfies SchemaShape<KnipReport>);

/**
 * Read Knip's JSON categories without losing grouped symbols or source positions.
 * @param check the check ID.
 * @param text the JSON report.
 * @param help the check help text.
 * @returns categorized findings, including each positioned member of a grouped issue.
 */
export function knipFindings(check: string, text: string, help: string): Finding[] {
    let report: KnipReport;
    try {
        report = knipReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'Knip returned invalid structured findings.', { cause: error });
    }
    const findings: Finding[] = [];
    for (const row of report.issues) {
        for (const category of KNIP_ISSUE_CATEGORIES) {
            findings.push(
                ...(row[category] ?? []).flatMap((issue) => {
                    const symbols = Array.isArray(issue) ? issue : [issue];
                    const names = symbols.map(({ name }) => name).join(', ');
                    return symbols.map((symbol) => {
                        const namespace = symbol.namespace === undefined ? '' : ` (${symbol.namespace})`;
                        return {
                            check,
                            file: row.file,
                            rule: category,
                            message: `${KNIP_ISSUE_MESSAGES[category]}: ${names}${namespace}`,
                            help,
                            fixable: false,
                            ...(symbol.line === undefined ? {} : { line: symbol.line }),
                            ...(symbol.col === undefined ? {} : { column: symbol.col }),
                        };
                    });
                }),
            );
        }
    }
    return findings;
}
