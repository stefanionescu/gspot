export type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    direction: string;
    scope: string;
};

/** One `[tools.<tool>.verbatim]` table: the keys it sets and why. */
export type ExtraRow = { tool: string; keys: string[]; reason?: string; scope: string };

/** The settings listing. */
export type SettingsListing = { rows: SettingRow[]; extras: ExtraRow[] };

/** The JSON response of selected and available configurations. */
export type ConfigurationsListJson = {
    selected: { name: string; checks: { name: string; scope: string; state: string }[] }[];
    available: { name: string; description: string }[];
};

/** Effective settings and authored native option extensions printed by list settings. */
export type SettingsListJson = { settings: SettingRow[]; extras: ExtraRow[] };
