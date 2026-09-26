import type { Value } from '#cli/types/policy/policy.ts';

/** Identify TOML values among concrete syntax nodes. */
export function isTomlValue(node: { type: string }): node is Value {
    return ['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable'].includes(node.type);
}
