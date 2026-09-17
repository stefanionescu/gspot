export function optional<Key extends string, Value>(
  key: Key,
  value: Value | undefined | null,
): Partial<Record<Key, Value>> {
  return value === undefined || value === null ? {} : ({ [key]: value } as Record<Key, Value>)
}
