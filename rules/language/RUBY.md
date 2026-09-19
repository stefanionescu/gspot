---
layer: language
preset: ruby
title: Ruby
---

# Ruby

These rules cover Ruby source, errors, objects, collections, metaprogramming, gems, and tests.

## Format and layout

- RuboCop decides the layout and the idiom. Fix a finding, and do not turn a cop off to save a line.
- Every file opens with `# frozen_string_literal: true`.
- One file defines one class or module, and the path matches the constant: `Billing::Invoice` lives in `billing/invoice.rb`.
- Keep a method under the line ceiling and a class under the class ceiling. Split by the job.
- Every class and module carries a comment that says what it is for.

## Names

- Methods and variables are `snake_case`, classes and modules are `CamelCase`, constants are `SCREAMING_SNAKE_CASE`.
- A method that answers yes or no ends in `?`. A method that changes its receiver or raises where its twin returns nil ends in `!`.
- Do not prefix a reader with `get_` or a predicate with `is_`.
- Name a block parameter for what it holds. One letter is for a one-line block.

## Errors

- Raise a class of your own that inherits from `StandardError`, never from `Exception`.
- Never `rescue Exception`, and never write a bare `rescue` that swallows the error.
- Rescue the narrowest class, in the place that can do something about it.
- Do not use an exception for a branch the caller expects. Return a value the caller can test.
- `ensure` releases what the method acquired: a file, a lock, a connection.

## Objects and methods

- Keep instance state private. Expose behavior, and expose a reader only where a caller needs the value.
- A method takes at most five parameters. Past three, use keyword arguments.
- Do not change an argument the caller passed in. Return a new value.
- Prefer composition and a small module over a deep inheritance chain.
- A class method that builds an instance is named for what it builds from: `from_json`, `parse`.
- Do not monkey-patch a core class. Where a refinement is the only way, keep it to one file, and say why in a comment.

## Collections and strings

- Use `map`, `select`, `reject`, `sum`, `each_with_object`, and `find` instead of a loop that fills an array.
- Use `fetch` for a key that must exist, so a missing key fails where it is read.
- Build a string with interpolation, never with `+` in a loop.
- Use a symbol for a name inside the program and a string for text a person or another system reads.

## Metaprogramming and safety

- Do not use `eval`, `instance_eval`, or `class_eval` with a string. Pass a block.
- `send` and `public_send` take a name from a fixed list, never a name a user supplied.
- A class that defines `method_missing` defines `respond_to_missing?` beside it.
- Never call `Marshal.load` or `YAML.load` on data from outside. Use `JSON.parse` or `YAML.safe_load`.
- Never pass user input to `Kernel#open`, `system`, or backticks. Pass an argument list, not a shell string.

## Gems and dependencies

- `Gemfile.lock` is committed, and every gem source uses HTTPS.
- Pin a gem with a pessimistic constraint, and group gems by where they load.
- Add a gem only for work the standard library does not do in a few lines.
- An advisory from bundler-audit is fixed by an upgrade, or recorded with the reason the code path is unreachable.

## Tests

- A test name says the behavior and the condition.
- One example checks one behavior. Shared setup that hides what a test depends on is worse than a repeated line.
- Do not sleep in a test, and do not call the network. Replace the client at the boundary.
- Freeze time in a test that reads the clock.
