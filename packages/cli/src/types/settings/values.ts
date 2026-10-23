import type { Optional } from '#cli/types/shapes.ts';
import { type CI_PROVIDERS } from '#cli/config/settings/ci.ts';
import type { LEVELS } from '#cli/config/configurations/names.ts';
import { type REEXPORT_MODES } from '#cli/config/settings/tables.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import type { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';

import {
    type QUOTE_STYLES,
    type LINE_ENDINGS,
    type TRAILING_COMMAS,
    type FORMAT_INDENT_STYLES,
} from '#cli/config/settings/fields.ts';

export type ReasonedValue<Value> = { value: Value; reason: string };

export type SettingValue<Value> = Value | ReasonedValue<Value>;

export type LimitFields<NumberValue> = Partial<Record<keyof ParsedLimitFields, NumberValue | undefined>>;

type LimitDefinition = (typeof LIMIT_DEFINITIONS)[keyof typeof LIMIT_DEFINITIONS];

/** The languages that at least one limit reads. */
export type LimitLanguage = Extract<LimitDefinition, { languages: readonly string[] }>['languages'][number];

/** The limits that some code reads for one language. */
export type LanguageLimitField<Language extends LimitLanguage> = {
    [Key in keyof typeof LIMIT_DEFINITIONS]: (typeof LIMIT_DEFINITIONS)[Key] extends {
        languages: readonly (infer Languages)[];
    }
        ? Language extends Languages
            ? Key extends `limits.${infer Field}`
                ? Field
                : never
            : never
        : never;
}[keyof typeof LIMIT_DEFINITIONS];

/** One language's limit table: only the limits that the language reads, each inherited from the root when unset. */
export type LanguageLimitFields<Language extends LimitLanguage, NumberValue> = Partial<
    Record<LanguageLimitField<Language>, NumberValue | undefined>
>;

type ParsedLimitFields = {
    file_lines: number;
    function_lines: number;
    function_parameters: number;
    function_statements: number;
    block_nesting: number;
    callback_nesting: number;
    cognitive_complexity: number;
    cyclomatic_complexity: number;
    function_branches: number;
    function_returns: number;
    function_assignments: number;
    closure_lines: number;
    type_lines: number;
    index_exports: number;
    trivial_function_statements: number;
    shared_prefix_files: number;
};

export type ParsedLimits = ParsedLimitFields & {
    [Language in LimitLanguage]?: LanguageLimitFields<Language, number> | undefined;
};

export type ParsedFormat = {
    indent_style: (typeof FORMAT_INDENT_STYLES)[number];
    indent_width: number;
    print_width: number;
    line_ending: (typeof LINE_ENDINGS)[number];
    final_newline: boolean;
    quotes?: (typeof QUOTE_STYLES)[number] | undefined;
    trailing_commas: (typeof TRAILING_COMMAS)[number];
    semicolons: boolean;
    override: (Optional<Omit<ParsedFormat, 'override'>> & { paths: string[] })[];
};

export type ParsedRoot = {
    level: (typeof LEVELS)[number];
    removed_configurations: string[];
    tool_timeout_seconds: number;
    test_files: string[];
    configurations: string[];
};

export type ParsedStructure = { reexports: (typeof REEXPORT_MODES)[number]; environment_readers: string[] };

export type ParsedHooks = { enabled: boolean };

export type ParsedCi = {
    enabled: boolean;
    provider: (typeof CI_PROVIDERS)[number];
    setup_command?: string[] | undefined;
    operating_systems: (typeof OPERATING_SYSTEMS)[number]['name'][];
};

export type ParsedRules = { enabled: boolean; exclude: string[] };
