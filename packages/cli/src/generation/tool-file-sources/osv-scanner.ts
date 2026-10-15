import { stringify } from '@decimalturn/toml-patch';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the osvScanner configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.ignoresFor the check path-ignore reader.
 *
 * @returns the generated configuration text.
 */
export function osvScannerToolFile({ ignoresFor }: Pick<ScopeView, 'ignoresFor'>): string {
    const entries = ignoresFor('dependencies/osv').filter(
        (entry) => entry.rule !== undefined && entry.paths.length === 0,
    );
    return stringify(
        entries.length === 0
            ? {}
            : {
                  IgnoredVulns: entries.map((entry) => ({
                      id: entry.rule,
                      ...(entry.until ? { ignoreUntil: entry.until } : {}),
                      reason: entry.reason,
                  })),
              },
        TOOL_EMIT_FORMAT,
    ).trimEnd();
}
