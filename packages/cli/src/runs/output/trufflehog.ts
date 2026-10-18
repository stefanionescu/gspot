// Reads secret findings from TruffleHog reports.
import { z } from 'zod';
import { parseReport } from '#cli/runs/output/json.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { type ReportInput, type TrufflehogResult } from '#cli/types/runs/output.ts';

const trufflehogResultSchema = z.object({
    DetectorName: z.string().min(1),
    Verified: z.literal(true),
    SourceMetadata: z.object({
        Data: z.object({
            Git: z.object({
                commit: z.string().regex(HASH_PATTERN),
                file: z.string(),
                line: z.number().int().nonnegative(),
            } satisfies SchemaShape<TrufflehogResult['SourceMetadata']['Data']['Git']>),
        } satisfies SchemaShape<TrufflehogResult['SourceMetadata']['Data']>),
    } satisfies SchemaShape<TrufflehogResult['SourceMetadata']>),
} satisfies SchemaShape<TrufflehogResult>);
/**
 * Read the verified TruffleHog results as findings, one per credential, without the secret.
 * @param input the tool output to read.
 * @returns credential locations and detector names without credential text.
 */
export function parseTrufflehogFindings(input: ReportInput): Finding[] {
    const { check, stdout, help } = input;
    return stdout
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const result = parseReport('TruffleHog', line, trufflehogResultSchema);
            const metadata = result.SourceMetadata.Data.Git;
            return {
                check,
                file: metadata.file,
                line: metadata.line,
                rule: result.DetectorName,
                message: `Verified ${result.DetectorName} credential in commit ${metadata.commit}.`,
                help,
                fixable: false,
            };
        });
}
