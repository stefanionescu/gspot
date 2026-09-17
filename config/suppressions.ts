export const SUPPRESSION_FORMS = [
  { name: 'eslint-disable', pattern: /eslint-disable(?:-next-line|-line)?\b(.*)$/u, owned: true },
  { name: '@ts-expect-error', pattern: /@ts-expect-error\b(.*)$/u, owned: true },
  { name: '# noqa', pattern: /#\s*noqa\b(.*)$/u, owned: true },
  { name: '# type: ignore', pattern: /#\s*type:\s*ignore\b(.*)$/u, owned: true },
  { name: '# nosec', pattern: /#\s*nosec\b(.*)$/u, owned: true },
  { name: 'swiftlint:disable', pattern: /swiftlint:disable\b(.*)$/u, owned: false },
  { name: 'shellcheck disable', pattern: /shellcheck\s+disable=\S+(.*)$/u, owned: false },
  { name: 'nosemgrep', pattern: /nosemgrep\b(.*)$/u, owned: false },
] as const

export const SUPPRESSION_REASON = /reason:\s*(\S.*?)\s*$/u
