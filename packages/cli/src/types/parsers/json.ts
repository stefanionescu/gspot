/** A validated JSON document or its syntax and schema problem. */
export type JsonDocument<T> = { data: T; error?: never } | { data?: never; error: string };
