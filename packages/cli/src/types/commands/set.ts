import type { Setting, EffectiveSetting } from '#cli/types/settings/inheritance.ts';

export type SetOptions = {
    cwd: string;
    key: string;
    values: string[];
    reason?: string;
    scope?: string;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

/** A proposed setting value and the reason rules that apply to it. */
export type SettingReasonContext = {
    options: SetOptions;
    setting: Setting;
    change: ParsedSettingValue;
    previous: EffectiveSetting | undefined;
    shippedDefault: unknown;
};
