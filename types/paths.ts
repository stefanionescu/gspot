export type Selector = {
  readonly matches: (path: string) => boolean
  readonly patterns: readonly string[]
}
