import type { z } from 'zod';
import { type Defined } from '#cli/types/shapes.ts';
import { type Check } from '#cli/types/configurations.ts';
import { type ParsedTools } from '#cli/types/settings/tools.ts';
import { type KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { formatSchema } from '#cli/schemas/settings/fields.ts';
import type { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { tableValuesSchema } from '#cli/schemas/settings/tables.ts';

export type TableValues = z.output<typeof tableValuesSchema>;

export type TableSettings<Name extends keyof TableValues> = NonNullable<TableValues[Name]>;

export type SettingsFile = {
    settings: Settings;
    text: string;
};

type StructureSettings = Defined<Required<NonNullable<ParsedSettings['structure']>>>;

export type Settings = Omit<
    ParsedSettings,
    'scope' | 'command_check' | 'tools' | 'structure' | 'hooks' | 'ci' | 'ignore'
> & {
    written: TomlTable;
    level: NonNullable<ParsedSettings['level']>;
    configurations: string[];
    removed_configurations: string[];
    structure: StructureSettings;
    tools: ParsedTools;
    test_files: string[];
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks?: Defined<Required<NonNullable<ParsedSettings['hooks']>>> | undefined;
    ci?: ParsedSettings['ci'];
    scopes: Map<string, NonNullable<ParsedSettings['scope']>[number] & Pick<Settings, 'written'>>;
};

export type CommandCheck = Check & {
    command: string[];
    files: NonNullable<Check['files']>;
};

export type SettingsTable = Settings | NonNullable<ReturnType<Settings['scopes']['get']>>;

export type WrittenFormat = z.input<typeof formatSchema>;

export type WrittenSettings = z.input<typeof settingsSchema>;

export type ParsedSettings = z.output<typeof settingsSchema>;

export type IgnoreRecord = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type TomlTable = Record<string, unknown>;
