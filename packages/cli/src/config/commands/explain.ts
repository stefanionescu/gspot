import type { SettingDeclaration } from '#cli/types/configurations.ts';

export const DIRECTION_TEXTS: Record<NonNullable<SettingDeclaration['direction']>, string> = {
    ceiling: 'a ceiling: raising it needs a reason',
    floor: 'a floor: lowering it needs a reason',
    loosening: 'a loosening: setting it needs a reason',
    tightening: 'a tightening: no reason needed',
    'rule-options': 'per rule: native options; accepting a finding requires an ignore',
};
