// Reads secret findings from TruffleHog reports.
// Reads secret findings from TruffleHog reports.
import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import type { TrufflehogResult } from '#cli/types/parsers/output.ts';

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
 * Findings from TruffleHog's verified results, one per credential, without the secret itself.
 * @param check the check ID.
 * @param stdout the JSON lines TruffleHog printed.
 * @param help the check's help text.
 * @returns the findings.
 */
export function parseTrufflehogFindings(check: string, stdout: string, help: string): Finding[] {
    const findings: Finding[] = [];
    for (const line of stdout.split('\n').filter((line) => line.trim() !== '')) {
        try {
            const result = trufflehogResultSchema.parse(JSON.parse(line));
            const metadata = result.SourceMetadata.Data.Git;
            findings.push({
                check,
                file: metadata.file,
                line: metadata.line,
                rule: result.DetectorName,
                message: `Verified ${result.DetectorName} credential in commit ${metadata.commit}.`,
                help,
                fixable: false,
            });
        } catch {
            throw new GspotError('output', 'TruffleHog returned invalid structured findings; raw output was withheld.');
        }
    }
    return findings;
}
