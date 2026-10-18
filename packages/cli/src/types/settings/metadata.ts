/** The schema metadata of a setting that takes a reasoned value: what it holds, and which change needs a reason. */
export type ReasonedSettingMetadata = { description: string; reason_needed: 'raising' | 'lowering' | 'adding' };
