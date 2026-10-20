// The release hold of the tools that gspot installs in .gspot: new releases wait the days that gspot.toml asks for.
import { findRootSelection } from '#cli/settings/scope-view.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { HoldUnit } from '#cli/types/generation/release-holds.ts';
import { HOLD_FACTORS, RELEASE_AGE_SETTING } from '#cli/config/generation/file-edits.ts';

/**
 * Write a hold of some days in the unit that the installer reads.
 *
 * @param unit what the installer counts in.
 * @param days how long a new release waits.
 * @returns the value for the settings file.
 */
function formatHold(unit: HoldUnit, days: number): number | string {
    return unit === 'uv-duration' ? `${String(days)} days` : days * HOLD_FACTORS[unit];
}

/**
 * Read the hold that the root gspot.toml asks for. The tool installs in .gspot use it.
 *
 * @param scopes every scope.
 * @returns the days that a new release waits.
 */
function readRootHoldDays(scopes: ScopeSelection[]): number {
    return Number(findRootSelection(scopes).view.settings[RELEASE_AGE_SETTING]);
}

export { formatHold, readRootHoldDays };
