# `language:css`

The smallest preset, and the one with the least reference evidence: only `slopshop` has CSS, and its
CSS checks are the most project-specific code in the reference set.

## Claims

```text
.css .pcss .postcss
.module.css      (CSS Modules, treated as a subtype)
.scss .sass      (declared, not supported in v0)
```

## Tools

| Kind | Tool                                         | Notes                                              |
| ---------- | -------------------------------------------- | -------------------------------------------------- |
| format     | Prettier                                     |                                                    |
| style      | `stylelint` with `stylelint-config-standard` |                                                    |
| syntax     | `postcss` parse                              |                                                    |
| structure  | gspot structure engine, postcss adapter      | File length, single-file folder, prefix collisions |
| naming     | gspot naming engine                          | Class and custom-property naming                   |
| dead       | preset check                                   | Unused selector detection, below                   |
| spelling   | `typos`                                      |                                                    |

## The unused-selector problem

`slopshop` implements `quality/workspace/integrity/css-usage.mjs` and
`quality/workspace/integrity/css.mjs` for this, and it is the right idea in the wrong place: unused
CSS detection is not project-specific, but the implementation is bound to that application's file
layout.

The generalised version, in the preset:

- **CSS Modules**: a class in a `.module.css` file is used when the generated TypeScript type for
  that module is referenced. Resolvable exactly, because the module maps to an import.
- **Global CSS**: a class is used when it appears as a string in any claimed source file, or in a
  `className` expression the structure engine can resolve. Unresolvable dynamic composition is
  reported as such rather than as unused.
- **Custom properties**: a `--name` is used when referenced in a `var()` or in a source file.
  Declared-and-unused fails; used-and-undeclared fails harder.

The second bullet is honest about its limit: string-built class names cannot be resolved, and the
check reports the count of unresolvable sites rather than guessing. A repository with many of them
gets a weaker check and knows it.

## Design tokens

`slopshop/CLEANUP.md` section 22 is about a styling system with three words for layered UI and one
word with seven homes. That class of problem is a naming and structure problem, and the preset's
contribution is:

| Check                           | Enforces                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `css/token-only-values`         | Colour, spacing and radius values come from custom properties, never literals, outside the token definition file |
| `css/one-token-file`            | Token definitions live in one declared file per category                                                         |
| `css/no-duplicate-token-values` | Two tokens with the same value fail, naming both                                                                 |

These are three checks that would have caught most of `CLEANUP.md` section 22 before it was written.

## Required kinds

```text
.css .pcss          format syntax style structure naming spelling dead
.module.css         the above, with exact usage resolution
```

No `prose`: CSS comments are `/* */` and Vale has no CSS grammar. Stated.

## Scope

`framework:nextjs` requires `language:css` and adds the Next.js-specific parts: the `app/**/*.css`
import boundary, `next/font` usage, and the rule that global CSS imports only from the root layout.
Those are framework facts, so they belong there and not here.
