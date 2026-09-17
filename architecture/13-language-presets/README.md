# Language Presets

One document per `language:` preset. Each states the tool matrix, the required inspections per
extension, the full coverage rule, and the settings.

| Preset                                         | Doc                                |
| -------------------------------------------- | ---------------------------------- |
| `language:typescript` | [typescript.md](typescript.md) |
| `language:javascript` | [javascript.md](javascript.md) |
| `language:python`                            | [python.md](python.md)             |
| `language:swift`                             | [swift.md](swift.md)               |
| `language:bash`                              | [bash.md](bash.md)                 |
| `language:sql`                               | [sql.md](sql.md)                   |
| `language:markdown`                          | [markdown.md](markdown.md)         |
| `language:css`                               | [css.md](css.md)                   |
| `repository:configuration`                              | [04-presets.md](../04-presets.md) |
| `language:html`, `repository:static-site`     | [html.md](html.md)                 |

## The common shape

Every language preset answers the same five questions.

1. **Which extensions and filenames does it claim?** The claim set, which feeds the coverage check
   candidate list.
1. **Which tool provides which inspection?** The matrix. An inspection with no provider is stated as
   a gap, not omitted.
1. **What is the required inspections per extension?** Including the exceptions, such as `.d.ts` having no
   `style` requirement.
1. **What does full coverage mean here?** The specific files that projects habitually exclude, and
   what gspot does instead.
1. **Which settings exist?** With direction.

## Kind coverage across the presets

A summary, so the gaps are visible in one place. `native` means a mature tool. `preset` means a check
the framework or language preset owns. `engine` means the gspot structure or naming engine. `none`
means no provider, and the coverage check reflects that by leaving the inspection out of the
required inspections.

| Kind  | ts     | py     | swift  | Bash   | sql    | md     | css    | data   | html   |
| ----------- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| format      | native | native | native | native | native | native | native | native |
| syntax      | native | native | native | native | native | native | native | native |
| schema      | native | native | none   | none   | none   | none   | none   | none   |
| style       | native | native | native | native | native | native | native | native |
| types       | native | native | native | none   | none   | none   | none   | stdin  |
| structure   | engine | engine | engine | engine | engine | none   | engine | preset   |
| naming      | engine | engine | engine | engine | engine | none   | engine | preset   |
| prose       | native | native | native | stdin  | stdin  | native | none   | none   |
| spelling    | native | native | native | native | native | native | native | native |
| security    | native | native | native | native | native | native | native | native |
| sast        | native | native | native | native | none   | none   | none   | none   |
| deps        | native | native | native | none   | none   | native | native | none   |
| license     | native | native | native | none   | none   | none   | none   | none   |
| duplication | native | native | native | native | native | none   | native | none   |
| dead        | native | native | native | engine | engine | none   | native | preset   |

Three gaps are worth naming because they are where a repository is most likely to be surprised:

- **No SQL SAST.** No maintained tool reads SQL for injection or privilege patterns the way Semgrep
  reads TypeScript. `platform:supabase` compensates with RLS presence and grant checks, and Semgrep
  rules over the TypeScript that builds SQL.
- **No `prose` for data formats or HTML.** Vale has no comment-only mode for either. Stated in
  [11-prose.md](../11-prose.md) and reflected in the required inspections.
- **No `types` for HTML, and no `structure`.** An inline script is extracted and handed to
  `language:javascript`; the HTML itself gets `syntax`, `style`, `accessibility` and the preset's own
  structural checks.
