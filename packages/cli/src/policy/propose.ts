// The proposed gspot.toml at init: the selection, the scopes, the carried lists, the choices.
import { stringify } from 'smol-toml';
import { patch } from '@decimalturn/toml-patch';
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

function xcodeTable(xcode: Proposal['xcode']): TomlTable | undefined {
    if (xcode === undefined) return undefined;
    return xcode.scheme === undefined ? { project: xcode.project } : { project: xcode.project, scheme: xcode.scheme };
}

function toolTables(carried: CarriedLists, commitScopes: string[] | undefined, xcode?: Proposal['xcode']): TomlTable {
    const tables: Record<string, TomlTable | undefined> = {
        typos: nonEmpty({ words: carried.typosWords, exclude: carried.typosExcludes }),
        gitleaks: nonEmpty({ allow: carried.gitleaksAllow }),
        sqlfluff: nonEmpty({ exclude: carried.sqlfluffExcludes }),
        semgrep: nonEmpty({ ignore: carried.semgrepIgnores }),
        osv: nonEmpty({ ignore: carried.osvIgnores }),
        licenses: nonEmpty({ allow: carried.licenseAllow, exceptions: carried.licenseExceptions }),
        commitlint: nonEmpty({ scopes: commitScopes ?? [] }),
        xcode: xcode?.scope === '' ? xcodeTable(xcode) : undefined,
    };
    return Object.fromEntries(Object.entries(tables).filter(([, table]) => table !== undefined));
}

function headTables(proposal: Proposal): TomlTable {
    const document: TomlTable = { version: 1, presets: proposal.presets };
    if (proposal.scopes.length > 0)
        document['scope'] = proposal.scopes.map((scope) => ({
            path: scope.path,
            presets: scope.presets,
            ...(proposal.xcode?.scope === scope.path ? { tools: { xcode: xcodeTable(proposal.xcode) } } : {}),
        }));
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

// The settings of a scope are written the way gspot set writes them, as one inline table inside the scope.
// The patcher refuses a document where one scope holds an inline tools table and another a sub-table.
function bodyText(document: TomlTable): string {
    const scopes = (document['scope'] as TomlTable[] | undefined) ?? [];
    const bare = { ...document, scope: scopes.map(({ tools: _tools, ...rest }) => rest) };
    const plain = stringify(scopes.length === 0 ? document : bare);
    // Arrays take the layout the TOML formatter keeps, so the first format check of the policy passes.
    const tight = plain.replaceAll(/= \[ (?<items>[^\n]*) \]$/gmu, '= [$<items>]');
    const seed = tight.endsWith('\n') ? tight : `${tight}\n`;
    if (scopes.every((scope) => scope['tools'] === undefined)) return seed;
    return patch(seed, document, { inlineTableStart: 2, bracketSpacing: false });
}

/**
 * The gspot.toml text for a proposal.
 * @param proposal the proposal
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(proposal: Proposal): string {
    const document = headTables(proposal);
    const tools = toolTables(proposal.carried, proposal.commitScopes, proposal.xcode);
    if (Object.keys(tools).length > 0) document['tools'] = tools;
    if (proposal.carried.ignores.length > 0) document['ignore'] = ignoreTables(proposal.carried);
    mergeProfile(document, proposal.profileTables);
    document['hooks'] = { ...asTable(document['hooks']), tool: proposal.hooks };
    document['ci'] = { ...asTable(document['ci']), provider: proposal.ci };
    document['rules'] = { directory: '.gspot/rules', ...asTable(document['rules']), install: proposal.rules };
    document['inspection'] = { strict: false, ...asTable(document['inspection']) };
    document['runner'] = { ...asTable(document['runner']), surface: proposal.runner };
    return `${PREFACE}${bodyText(document)}`;
}
