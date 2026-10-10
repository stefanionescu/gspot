/** A validated JSON document or its syntax and schema error. */
export type JsonDocument<T> = { data: T; error?: never } | { data?: never; error: string };
