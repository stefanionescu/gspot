export type Parsed<Value, Failure = string> = { value: Value } | { error: Failure };

export type Optional<Value> = { [Key in keyof Value]?: Value[Key] | undefined };

export type Defined<Value> = { [Key in keyof Value]: Exclude<Value[Key], undefined> };

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
