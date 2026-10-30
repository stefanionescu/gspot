import type { TableSettings } from '#cli/types/settings/settings.ts';
import type { LIMIT_DEFINITIONS } from '#cli/config/settings/definitions/limits.ts';

export type ReasonedValue<Value> = { value: Value; reason: string };

type LimitDefinition = (typeof LIMIT_DEFINITIONS)[keyof typeof LIMIT_DEFINITIONS];

export type LimitLanguage = Extract<LimitDefinition, { languages: readonly string[] }>['languages'][number];

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

export type ParsedStructure = TableSettings<'structure'>;
