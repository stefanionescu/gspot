// The six writing commands: one entry at a time, validated as load does, then sync.
import { findRoot } from '#cli/repository/tracked.ts';
import { reasonAccepted } from '#cli/policy/loosening.ts';
import * as messages from '#cli/policy/messages.ts';
import { nearMatches } from '#cli/policy/near.ts';
import { PolicyError } from '#cli/policy/load.ts';
import { specFor, resolveSetting } from '#cli/policy/settings.ts';
import {
    appendEntry,
    appendList,
    deleteKey,
    removeEntries,
    removeFromList,
    setKey,
    writePolicy,
} from '#cli/policy/write.ts';
import type { Mutation } from '#cli/policy/write.ts';
import { syncAll } from '#cli/render/sync.ts';
import { openSession } from '#cli/run/session.ts';
import { loadManifests } from '#cli/presets/load.ts';
import { allChecks } from '#cli/presets/catalog.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { CommandResult } from '#cli/run/check.ts';

type Raw = Record<string, unknown>;

const ALLOW_LISTS: Record<
    string,
    {
        key: string;
        shape: (values: string[], reason: string | undefined, extra: Record<string, string>) => unknown[];
        reasonRequired: boolean;
        match: (entry: unknown, value: string) => boolean;
    }
> = {
    typos: {
        key: 'tools.typos.words',
        reasonRequired: false,
        shape: (values, reason) => values.map((word) => ({ word, reason: reason ?? word })),
        match: (entry, value) => (entry as Raw)['word'] === value,
    },
    'typos-exclude': {
        key: 'tools.typos.exclude',
        reasonRequired: true,
        shape: (values, reason) => [{ paths: values, reason }],
        match: (entry, value) => ((entry as Raw)['paths'] as string[]).includes(value),
    },
    licenses: {
        key: 'tools.licenses.exceptions',
        reasonRequired: true,
        shape: (values, reason, extra) =>
            values.map((name) => ({ package: name, license: extra['license'] ?? 'UNKNOWN', reason })),
        match: (entry, value) => (entry as Raw)['package'] === value,
    },
    naming: {
        key: 'naming.allowed',
        reasonRequired: true,
        shape: (values, reason) => values.map((name) => ({ name, reason })),
        match: (entry, value) => (entry as Raw)['name'] === value,
    },
    'naming-external': {
        key: 'naming.external',
        reasonRequired: false,
        shape: (values) => values,
        match: (entry, value) => entry === value,
    },
    gitleaks: {
        key: 'tools.gitleaks.allow',
        reasonRequired: true,
        shape: (values, reason) => [{ description: reason, paths: values, regexes: [], reason }],
        match: (entry, value) => ((entry as Raw)['paths'] as string[]).includes(value),
    },
    osv: {
        key: 'tools.osv.ignore',
        reasonRequired: true,
        shape: (values, reason) => values.map((id) => ({ id, reason })),
        match: (entry, value) => (entry as Raw)['id'] === value,
    },
};

async function commit(root: string, mutation: Mutation, dryRun: boolean, describe: string): Promise<CommandResult> {
    const result = writePolicy(root, mutation, dryRun);
    if (dryRun)
        return {
            text: `${describe}\n(dry run: gspot.toml not written)\n`,
            json: { text: result.text, dryRun: true },
            exitCode: 0,
        };
    const session = await openSession(root);
    await syncAll(session);
    return { text: `${describe}\n`, json: { changed: result.changed }, exitCode: 0 };
}

function requireReason(reason: string | undefined, where: string, command: string): void {
    if (reason === undefined) throw new PolicyError([messages.missingReason(where, command)]);
    if (!reasonAccepted(reason)) throw new PolicyError([messages.refusedReason(where, reason)]);
}

function knownCheck(id: string): void {
    if (!allChecks().has(id))
        throw new PolicyError([messages.unknownCheck(id, nearMatches(id, [...allChecks().keys()]))]);
}

/** gspot ignore <check> [--paths] [--rule] --reason | --remove */
export async function ignoreCommand(o: {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    knownCheck(o.check);
    if (o.remove) {
        const counter = { removed: 0 };
        const paths = o.paths ?? [];
        const result = await commit(
            root,
            removeEntries(
                'ignore',
                (entry) =>
                    entry['check'] === o.check &&
                    (entry['rule'] ?? undefined) === o.rule &&
                    JSON.stringify(entry['paths'] ?? []) === JSON.stringify(paths),
                counter,
            ),
            o.dryRun,
            '',
        );
        return {
            ...result,
            text: `${counter.removed === 0 ? 'no matching ignore entry' : `removed ${counter.removed} ignore entr${counter.removed === 1 ? 'y' : 'ies'} for ${o.check}`}\n`,
        };
    }
    requireReason(
        o.reason,
        `gspot ignore ${o.check}`,
        `gspot ignore ${o.check}${o.rule ? ` --rule ${o.rule}` : ''}${o.paths ? ` --paths ${o.paths.map((path) => `"${path}"`).join(' ')}` : ''} --reason "..."`,
    );
    const entry: Raw = { check: o.check };
    if (o.rule) entry['rule'] = o.rule;
    if (o.paths && o.paths.length > 0) entry['paths'] = o.paths;
    entry['reason'] = o.reason;
    const lines = [
        '[[ignore]]',
        `check  = "${o.check}"`,
        ...(o.rule ? [`rule   = "${o.rule}"`] : []),
        ...(o.paths && o.paths.length > 0 ? [`paths  = ${JSON.stringify(o.paths)}`] : []),
        `reason = ${JSON.stringify(o.reason)}`,
    ];
    return commit(root, appendEntry('ignore', entry), o.dryRun, lines.join('\n'));
}

/** gspot add <preset>... [--scope] */
export async function addCommand(o: {
    cwd: string;
    presets: string[];
    scope?: string;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = loadManifests();
    for (const id of o.presets)
        if (!manifests.has(id))
            throw new PolicyError([messages.unknownPreset(id, nearMatches(id, [...manifests.keys()]))]);
    const mutation: Mutation = (raw) => {
        if (o.scope === undefined) {
            const list = (raw['presets'] as string[] | undefined) ?? [];
            for (const id of o.presets) if (!list.includes(id)) list.push(id);
            raw['presets'] = list;
            return;
        }
        const scopes = (raw['scope'] as Raw[] | undefined) ?? [];
        const scope = scopes.find((entry) => entry['path'] === o.scope);
        if (!scope) throw new PolicyError([messages.scopeMissing(o.scope!)]);
        const list = (scope['presets'] as string[] | undefined) ?? [];
        for (const id of o.presets) if (!list.includes(id)) list.push(id);
        scope['presets'] = list;
    };
    const result = await commit(
        root,
        mutation,
        o.dryRun,
        `added ${o.presets.join(', ')}${o.scope ? ` to scope ${o.scope}` : ''}`,
    );
    return result;
}

/** gspot remove <preset> [--scope] */
export async function removeCommand(o: {
    cwd: string;
    preset: string;
    scope?: string;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const mutation: Mutation = (raw) => {
        const holder =
            o.scope === undefined
                ? raw
                : ((raw['scope'] as Raw[] | undefined) ?? []).find((entry) => entry['path'] === o.scope);
        if (!holder) throw new PolicyError([messages.scopeMissing(o.scope!)]);
        const list = ((holder['presets'] as string[] | undefined) ?? []).filter((id) => id !== o.preset);
        holder['presets'] = list;
    };
    return commit(
        root,
        mutation,
        o.dryRun,
        `removed ${o.preset}${o.scope ? ` from scope ${o.scope}` : ''}; files it rendered are gone after sync`,
    );
}

/** gspot allow <list> <value>... [--reason] [--license] [--remove] */
export async function allowCommand(o: {
    cwd: string;
    list: string;
    values: string[];
    reason?: string;
    license?: string;
    remove: boolean;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const spec = ALLOW_LISTS[o.list];
    if (!spec)
        throw new PolicyError([
            `\`${o.list}\` is not an allow list. The lists are ${Object.keys(ALLOW_LISTS)
                .map((name) => `\`${name}\``)
                .join(', ')}.`,
        ]);
    if (o.remove) {
        const mutation: Mutation = (raw) => {
            const parts = spec.key.split('.');
            let holder: Raw | undefined = raw;
            for (const part of parts.slice(0, -1)) holder = holder?.[part] as Raw | undefined;
            const name = parts[parts.length - 1]!;
            if (!holder || !Array.isArray(holder[name])) return;
            holder[name] = (holder[name] as unknown[]).filter(
                (entry) => !o.values.some((value) => spec.match(entry, value)),
            );
        };
        return commit(root, mutation, o.dryRun, `removed ${o.values.join(', ')} from ${spec.key}`);
    }
    if (spec.reasonRequired)
        requireReason(o.reason, `gspot allow ${o.list}`, `gspot allow ${o.list} ${o.values.join(' ')} --reason "..."`);
    else if (o.reason !== undefined && !reasonAccepted(o.reason))
        throw new PolicyError([messages.refusedReason(`gspot allow ${o.list}`, o.reason)]);
    const entries = spec.shape(o.values, o.reason, o.license ? { license: o.license } : {});
    return commit(
        root,
        appendList(spec.key, entries),
        o.dryRun,
        `${spec.key} += ${entries.map((entry) => JSON.stringify(entry)).join(', ')}`,
    );
}

function parseValue(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
    return text;
}

/** gspot set <key> [<value>...] [--reason] [--scope] [--replace | --remove | --default] */
export async function setCommand(o: {
    cwd: string;
    key: string;
    values: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    const selection = session.scopes.find((entry) => entry.scope.path === (o.scope ?? '')) ?? session.scopes[0]!;
    const match = specFor(selection.surface, o.key);
    if (!match) {
        const prefix = o.key
            .split('.')
            .slice(0, o.key.startsWith('tools.') ? 2 : 1)
            .join('.');
        const known = [...selection.surface.specs.keys()]
            .filter((key) => key.startsWith(`${prefix}.`))
            .map((key) => key.slice(prefix.length + 1));
        throw new PolicyError([
            messages.settingNotExposed(
                o.key,
                known.length > 0 ? known : [...selection.surface.specs.keys()].slice(0, 12),
            ),
        ]);
    }
    const scoped = (key: string) => (o.scope === undefined ? key : `scope.${o.scope}.${key}`);
    const keyPath = (raw: Raw): { holder: Raw; key: string } => {
        if (o.scope === undefined) return { holder: raw, key: o.key };
        const scope = ((raw['scope'] as Raw[] | undefined) ?? []).find((entry) => entry['path'] === o.scope);
        if (!scope) throw new PolicyError([messages.scopeMissing(o.scope!)]);
        return { holder: scope, key: o.key };
    };
    const { spec } = match;
    if (spec.direction === 'per-rule' && o.values.some((value) => value === 'off')) {
        const tool = o.key.split('.')[1] ?? '';
        const rule = o.key.split('.').slice(3).join('.');
        throw new PolicyError([messages.ruleOffRefused(`<the check that runs ${tool}>`, rule)]);
    }
    if (o.toDefault) {
        const mutation: Mutation = (raw) => {
            const { holder, key } = keyPath(raw);
            deleteKey(key)(holder);
        };
        return commit(root, mutation, o.dryRun, `${scoped(o.key)} back to the shipped default`);
    }
    if (o.values.length === 0)
        throw new PolicyError([`gspot set ${o.key} needs a value, or --default to remove yours.`]);
    const parsed = o.values.map(parseValue);
    const shipped = selection.surface.defaults.get(spec.name)?.value;
    const isList = spec.kind === 'list';
    const value = isList
        ? parsed.length === 1 && Array.isArray(parsed[0])
            ? (parsed[0] as unknown[])
            : parsed
        : parsed.length === 1
          ? parsed[0]
          : parsed;
    const loosening =
        spec.direction === 'loosening' ||
        (spec.direction === 'ceiling' && typeof value === 'number' && typeof shipped === 'number' && value > shipped) ||
        (spec.direction === 'floor' && typeof value === 'number' && typeof shipped === 'number' && value < shipped) ||
        (isList && (o.remove || o.replace) && spec.direction !== 'neutral');
    if (loosening)
        requireReason(o.reason, `gspot set ${o.key}`, `gspot set ${o.key} ${o.values.join(' ')} --reason "..."`);
    else if (o.reason !== undefined && !reasonAccepted(o.reason))
        throw new PolicyError([messages.refusedReason(`gspot set ${o.key}`, o.reason)]);
    const written = o.reason !== undefined && !isList ? { value, reason: o.reason } : value;
    const mutation: Mutation = (raw) => {
        const { holder, key } = keyPath(raw);
        if (isList && o.remove) removeFromList(key, value as unknown[])(holder);
        else if (isList && !o.replace) appendList(key, value as unknown[])(holder);
        else setKey(key, written)(holder);
    };
    const current = resolveSetting(selection.surface, session.loaded.policy, o.key, o.scope);
    return commit(
        root,
        mutation,
        o.dryRun,
        `${scoped(o.key)} = ${JSON.stringify(value)}${o.reason ? `  # ${o.reason}` : ''}${current ? `  (was ${JSON.stringify(current.value)} from ${current.source})` : ''}`,
    );
}

/** gspot declare <glob>... [--produced-by | --vendored] [--reason] [--remove] */
export async function declareCommand(o: {
    cwd: string;
    paths: string[];
    producedBy?: string;
    vendored: boolean;
    reason?: string;
    remove: boolean;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    if (o.remove) {
        const counter = { removed: 0 };
        const result = await commit(
            root,
            removeEntries('declare', (entry) => JSON.stringify(entry['paths']) === JSON.stringify(o.paths), counter),
            o.dryRun,
            '',
        );
        return {
            ...result,
            text: `${counter.removed === 0 ? 'no matching declare entry' : `removed the declaration for ${o.paths.join(' ')}`}\n`,
        };
    }
    if (!o.producedBy && !o.vendored)
        throw new PolicyError([
            'gspot declare needs --produced-by "<command>" for a generated file, or --vendored --reason "..." for vendored source.',
        ]);
    if (o.vendored)
        requireReason(
            o.reason,
            'gspot declare --vendored',
            `gspot declare ${o.paths.join(' ')} --vendored --reason "..."`,
        );
    const entry: Raw = { paths: o.paths };
    if (o.producedBy) entry['produced_by'] = o.producedBy;
    if (o.vendored) entry['vendored'] = true;
    if (o.reason) entry['reason'] = o.reason;
    return commit(
        root,
        appendEntry('declare', entry),
        o.dryRun,
        `[[declare]]\npaths = ${JSON.stringify(o.paths)}${o.producedBy ? `\nproduced_by = ${JSON.stringify(o.producedBy)}` : ''}${o.vendored ? '\nvendored = true' : ''}${o.reason ? `\nreason = ${JSON.stringify(o.reason)}` : ''}`,
    );
}
