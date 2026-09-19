# `ruby`

Kind: language. Requires: structure, formatting. Recommends: spelling, dependencies, security.

## Detects and claims

|        |                                                                                   |
| ------ | --------------------------------------------------------------------------------- |
| Detect | `Gemfile`, `.rb` files                                                            |
| Claims | `.rb`, `.rake`, `.gemspec`, `Gemfile`, `Gemfile.lock`, `Rakefile`, `.rubocop.yml` |

## Tools

ruby from the host, RuboCop 1.91.0 and bundler-audit 0.9.3 through the mise `gem:` backend. The
repository owns its Ruby version, through `.ruby-version`.

A gem with a native extension runs only under the Ruby it was built for. Where two Rubies sit on
one machine, the one that installed the gems comes first on the PATH.

## Generated configuration

`.gspot/rubocop.yml`, with a stub `.rubocop.yml` at the root that holds one line,
`inherit_from`, so an editor finds the same rules. `NewCops: enable` turns on every cop a new
release adds. Cyclomatic and perceived complexity sit at 8, a method at `limits.function_lines`, a
class and a module at `limits.file_lines`, and a parameter list at five. `Style/Documentation`,
`Style/FrozenStringLiteralComment`, and the four `Security` cops are on by name. `vendor`,
`node_modules`, `tmp`, `bin`, and `db/schema.rb` are left out.

## Checks

| Id                   | Stage         | Command                                                                                                 |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `ruby/rubocop`       | commit        | `rubocop --config .gspot/rubocop.yml --force-exclusion --format json`; the fixer passes `--autocorrect` |
| `ruby/bundler-audit` | push, network | `bundler-audit check --update --format json`; one finding for each advisory, with the patched versions  |

The rule of a `ruby/rubocop` finding is the cop, such as `Security/Eval`. The rule of a
`ruby/bundler-audit` finding is the advisory id, or `insecure-source` for a gem source over plain
HTTP.

## Settings

`limits.function_lines` and `limits.file_lines` for ruby. A cop the repository decides against is
`gspot ignore ruby/rubocop --rule <cop>`.

## Rule files

`language/RUBY.md`.
