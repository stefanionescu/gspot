// The shared option schemas: limits, allowlists, roles, directories.
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

/** A list of strings. */
export const stringList: JSONSchema4 = { type: 'array', items: { type: 'string' } };

/**
 * An object with the given properties and nothing else.
 * @param properties the property schemas
 * @param required the property names that must be present
 * @returns the schema
 */
export function optionsSchema(properties: Record<string, JSONSchema4>, required: string[] = []): JSONSchema4 {
    return { type: 'object', properties, additionalProperties: false, ...(required.length > 0 ? { required } : {}) };
}

/** A positive integer. */
export const positiveInteger: JSONSchema4 = { type: 'integer', minimum: 1 };

/** Alias prefixes to root-relative directories, tsconfig paths style: { "@/": "src/" }. */
export const aliasMap: JSONSchema4 = { type: 'object', additionalProperties: { type: 'string' } };
