// The proposed gspot.toml at init: the selection, the scopes, the carried lists, the choices.
import { stringify } from 'smol-toml';

import { SCHEMA_LINE } from '#config/markers.ts';
import type { CarriedLists } from '#cli/render/takeover.ts';
import type { FormatConfig } from '#types/config.ts';

export type Proposal = {
    presets: string[];
    scopes: { path: string; presets: string[] }[];
    carried: CarriedLists;
    hooks: 'gspot' | 'lefthook' | 'husky' | 'none';
    ci: 'github' | 'none';
    rules: boolean;
    runner: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';
    format?: Partial<FormatConfig>;
    typesDirectory?: string;
    commitScopes?: string[];
};

type Raw = Record<string, unknown>;

/** The gspot.toml text for a proposal. */
export function proposeText(proposal: Proposal): string {
    const doc: Raw = { version: 1, presets: proposal.presets };
    if (proposal.scopes.length > 0)
        doc['scope'] = proposal.scopes.map((scope) => ({ path: scope.path, presets: scope.presets }));
    if (proposal.format && Object.keys(proposal.format).length > 0) doc['format'] = proposal.format;
    if (proposal.typesDirectory) doc['architecture'] = { types_directory: proposal.typesDirectory };
    const tools: Raw = {};
    const { carried } = proposal;
    if (carried.typosWords.length > 0 || carried.typosExcludes.length > 0) {
        const typos: Raw = {};
        if (carried.typosWords.length > 0) typos['words'] = carried.typosWords;
        if (carried.typosExcludes.length > 0) typos['exclude'] = carried.typosExcludes;
        tools['typos'] = typos;
    }
    if (carried.gitleaksAllow.length > 0) tools['gitleaks'] = { allow: carried.gitleaksAllow };
    if (carried.osvIgnores.length > 0) tools['osv'] = { ignore: carried.osvIgnores };
    if (carried.licenseExceptions.length > 0 || carried.licenseAllow.length > 0) {
        const licenses: Raw = {};
        if (carried.licenseAllow.length > 0) licenses['allow'] = carried.licenseAllow;
        if (carried.licenseExceptions.length > 0) licenses['exceptions'] = carried.licenseExceptions;
        tools['licenses'] = licenses;
    }
    if (proposal.commitScopes && proposal.commitScopes.length > 0)
        tools['commitlint'] = { scopes: proposal.commitScopes };
    if (Object.keys(tools).length > 0) doc['tools'] = tools;
    if (carried.ignores.length > 0)
        doc['ignore'] = carried.ignores.map((entry) => ({
            check: entry.check,
            rule: entry.rule,
            ...(entry.paths ? { paths: entry.paths } : {}),
            reason: entry.reason,
        }));
    doc['hooks'] = { manager: proposal.hooks };
    doc['ci'] = { provider: proposal.ci };
    doc['rules'] = { install: proposal.rules, directory: '.gspot/rules' };
    doc['coverage'] = { strict: false };
    doc['runner'] = { surface: proposal.runner };
    const body = stringify(doc);
    return `${SCHEMA_LINE}\n\n# The policy of this repository under gspot. Every setting has a command that writes it:\n# gspot set, allow, ignore, declare, add, remove. Run gspot explain <anything> for what it means.\n\n${body.endsWith('\n') ? body : `${body}\n`}`;
}
