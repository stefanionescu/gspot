// The proposed gspot.toml at init: the selection, the scopes, the carried lists, the choices.
import { stringify } from 'smol-toml';
import { SCHEMA_LINE } from '#config/markers.ts';
import type { CarriedLists } from '#types/lifecycle.ts';
import type { TomlTable, Proposal } from '#types/config.ts';

const PREFACE = [
    SCHEMA_LINE,
    '',
    '# The policy of this repository under gspot. Every setting has a command that writes it:',
    '# gspot set, allow, ignore, declare, add, remove. Run gspot explain <anything> for what it means.',
    '',
    '',
].join('\n');

function nonEmpty(table: Record<string, unknown[]>): TomlTable | undefined {
    const kept = Object.entries(table).filter(([, list]) => list.length > 0);
    return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

function toolTables(carried: CarriedLists, commitScopes: string[] | undefined): TomlTable {
    const tables: Record<string, TomlTable | undefined> = {
        typos: nonEmpty({ words: carried.typosWords, exclude: carried.typosExcludes }),
        gitleaks: nonEmpty({ allow: carried.gitleaksAllow }),
        osv: nonEmpty({ ignore: carried.osvIgnores }),
        licenses: nonEmpty({ allow: carried.licenseAllow, exceptions: carried.licenseExceptions }),
        commitlint: nonEmpty({ scopes: commitScopes ?? [] }),
    };
    return Object.fromEntries(Object.entries(tables).filter(([, table]) => table !== undefined));
}

function headTables(proposal: Proposal): TomlTable {
    const document: TomlTable = { version: 1, presets: proposal.presets };
    if (proposal.scopes.length > 0)
        document['scope'] = proposal.scopes.map((scope) => ({ path: scope.path, presets: scope.presets }));
    if (proposal.format !== undefined && Object.keys(proposal.format).length > 0) document['format'] = proposal.format;
    if (proposal.typesDirectory !== undefined) document['architecture'] = { types_directory: proposal.typesDirectory };
    return document;
}

function ignoreTables(carried: CarriedLists): TomlTable[] {
    return carried.ignores.map((entry) => ({
        check: entry.check,
        rule: entry.rule,
        ...(entry.paths === undefined ? {} : { paths: entry.paths }),
        reason: entry.reason,
    }));
}

const PROFILE_HEAD = new Set(['version', 'profile', 'selection', 'presets']);

function asTable(value: unknown): TomlTable {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as TomlTable) : {};
}

// A profile's tables are copied in; a table init also writes (tools, format) keeps both, the profile's keys first.
function mergeProfile(document: TomlTable, tables: TomlTable | undefined): void {
    const entries = Object.entries(tables ?? {}).filter(([key]) => !PROFILE_HEAD.has(key));
    for (const [key, value] of entries) {
        const existing = document[key];
        const isBothTables = Object.keys(asTable(existing)).length > 0 && Object.keys(asTable(value)).length > 0;
        document[key] = isBothTables ? { ...asTable(value), ...asTable(existing) } : value;
    }
}

/**
 * The gspot.toml text for a proposal.
 * @param proposal the proposal
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(proposal: Proposal): string {
    const document = headTables(proposal);
    const tools = toolTables(proposal.carried, proposal.commitScopes);
    if (Object.keys(tools).length > 0) document['tools'] = tools;
    if (proposal.carried.ignores.length > 0) document['ignore'] = ignoreTables(proposal.carried);
    mergeProfile(document, proposal.profileTables);
    document['hooks'] = { ...asTable(document['hooks']), tool: proposal.hooks };
    document['ci'] = { ...asTable(document['ci']), provider: proposal.ci };
    document['rules'] = { directory: '.gspot/rules', ...asTable(document['rules']), install: proposal.rules };
    document['inspection'] = { strict: false, ...asTable(document['inspection']) };
    document['runner'] = { ...asTable(document['runner']), surface: proposal.runner };
    const body = stringify(document);
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return `${PREFACE}${ended}`;
}
