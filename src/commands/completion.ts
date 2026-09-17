import type { Shell } from 'types/commands'
import { COMMANDS } from '@config/commands'

export function completionFor(shell: Shell): string {
  const names = COMMANDS.join(' ')
  switch (shell) {
    case 'bash':
      return [
        '_gspot() {',
        `  local commands="${names}"`,
        '  COMPREPLY=($(compgen -W "$commands" -- "${COMP_WORDS[COMP_CWORD]}"))',
        '}',
        'complete -F _gspot gspot',
        '',
      ].join('\n')
    case 'zsh':
      return [
        '#compdef gspot',
        `_arguments '1:command:(${names})'`,
        '',
      ].join('\n')
    case 'fish':
      return [
        ...COMMANDS.map((name) => `complete -c gspot -n __fish_use_subcommand -a ${name}`),
        '',
      ].join('\n')
  }
}
