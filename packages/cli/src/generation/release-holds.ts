// Writes the release hold into the settings file of every installer that a scope uses.
import { DAYS_PER_WEEK } from '#cli/config/units.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import type { Files } from '#cli/types/system/files.ts';
import { openKeysDocument } from '#cli/ownership/managed-keys.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { HoldUnit, ReleaseHold } from '#cli/types/generation/release-holds.ts';

import {
    DAY_COUNT,
    BUNFIG_FILE,
    SCANNER_KEY,
    HOLD_FACTORS,
    RELEASE_HOLDS,
    HOLD_DURATION,
    SCANNER_SETTING,
    RELEASE_AGE_SETTING,
    YARN_BERRY_LOCKFILE_MARK,
    DEPENDENCIES_CONFIGURATION,
} from '#cli/config/generation/file-edits.ts';

/**
 * Write a hold of some days in the unit that the installer reads.
 * @param unit what the installer counts in.
 * @param days how long a new release waits.
 * @returns the value for the settings file.
 */
function formatHold(unit: HoldUnit, days: number): number | string {
    if (unit === 'seconds' || unit === 'minutes') return days * HOLD_FACTORS[unit];
    if (unit === 'days') return String(days);
    return unit === 'uv-duration' ? `${String(days)} days` : `${String(days)}d`;
}

/**
 * Read a hold back into days, so a longer hold that the file already has can stay.
 * @param unit what the installer counts in.
 * @param value what the file holds.
 * @returns the hold in days, or undefined when the value has another form.
 */
function readHoldDays(unit: HoldUnit, value: number | string): number | undefined {
    if (typeof value === 'number')
        return unit === 'seconds' || unit === 'minutes' ? value / HOLD_FACTORS[unit] : undefined;
    if (unit === 'days') return DAY_COUNT.test(value) ? Number(value) : undefined;
    return readDurationDays(value);
}

/**
 * Read a uv or mise duration, such as `7 days` or `2w`, into days.
 * @param value what the settings file holds.
 * @returns the days, or undefined for another form.
 */
function readDurationDays(value: string): number | undefined {
    const match = HOLD_DURATION.exec(value)?.groups;
    if (match === undefined) return undefined;
    return Number(match['count']) * (match['unit']?.startsWith('w') === true ? DAYS_PER_WEEK : 1);
}

/**
 * Check whether a scope uses the installer: one of its files sits in the scope folder.
 * @param files the repository handle.
 * @param prefix the scope folder, with a trailing slash, or empty for the root.
 * @param hold the installer.
 * @returns true when the scope uses the installer.
 */
function isHoldInUse(files: Files, prefix: string, hold: ReleaseHold): boolean {
    return hold.files.some((name) => {
        const found = files.read(`${prefix}${name}`);
        if (found === undefined) return false;
        return hold.berry !== true || decodeUtf8(found.bytes)?.includes(YARN_BERRY_LOCKFILE_MARK) === true;
    });
}

/**
 * Build the hold keys for the settings file of one installer. A longer hold and the excludes in the file stay.
 *
 * @param files the repository handle.
 * @param path the settings file.
 * @param hold the installer.
 * @param days the hold that gspot.toml asks for.
 *
 * @returns the keys and their values.
 */
function buildHoldChanges(files: Files, path: string, hold: ReleaseHold, days: number): FileEdit['changes'] {
    const document = openKeysDocument(path, files.read(path));
    const current = document.getValue(hold.age);
    const isLonger =
        (typeof current === 'number' || typeof current === 'string') && (readHoldDays(hold.unit, current) ?? 0) >= days;
    const changes: FileEdit['changes'] = [{ path: hold.age, value: isLonger ? current : formatHold(hold.unit, days) }];
    if (hold.excludes !== undefined) {
        const written = document.getValue(hold.excludes);
        const own = (Array.isArray(written) ? written : [written]).filter(
            (item): item is string => typeof item === 'string',
        );
        changes.push({ path: hold.excludes, value: [...new Set([...own, ...(hold.excluded ?? [])])] });
    }
    return changes;
}

/**
 * Build the release hold for each installer that a scope uses, in scopes that select dependencies.
 * @param repositoryRoot where the scopes sit.
 * @param scopes every scope.
 * @returns each settings file and the keys gspot sets in it.
 */
function buildReleaseHoldEdits(repositoryRoot: string, scopes: ScopeSelection[]): FileEdit[] {
    using files = openFiles(repositoryRoot);
    return scopes
        .filter((selection) =>
            selection.selected.some((manifest) => manifest.configuration.name === DEPENDENCIES_CONFIGURATION),
        )
        .flatMap((selection) => {
            const prefix = joinScope(selection.scope.path, '');
            const { settings } = selection.view;
            const days = Number(settings[RELEASE_AGE_SETTING]);
            return RELEASE_HOLDS.filter((hold) => isHoldInUse(files, prefix, hold)).map((hold) => {
                const path = `${prefix}${hold.target}`;
                const changes = buildHoldChanges(files, path, hold, days);
                const scanner = settings[SCANNER_SETTING];
                if (hold.target === BUNFIG_FILE && typeof scanner === 'string')
                    changes.push({ path: SCANNER_KEY, value: scanner });
                return { path, changes };
            });
        });
}

/**
 * Read the hold that the root gspot.toml asks for. The tool installs in .gspot use it.
 * @param scopes every scope.
 * @returns the days that a new release waits.
 */
function readRootHoldDays(scopes: ScopeSelection[]): number {
    const root = scopes.find((selection) => selection.scope.path === '') as ScopeSelection;
    return Number(root.view.settings[RELEASE_AGE_SETTING]);
}

export { formatHold, readRootHoldDays, buildReleaseHoldEdits };
