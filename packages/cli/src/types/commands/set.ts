import type { Setting, InheritedSetting } from '#cli/types/settings/inheritance.ts';

export type SetOptions = {
    cwd: string;
    key: string;
    values: string[];
    reason?: string;
    scope?: string;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

export type SettingReasonContext = {
    options: SetOptions;
    setting: Setting;
    change: ParsedSettingValue;
    previous: InheritedSetting | undefined;
    shippedDefault: unknown;
};
