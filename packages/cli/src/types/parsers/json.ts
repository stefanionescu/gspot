/** A value JSON can encode without conversion. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
