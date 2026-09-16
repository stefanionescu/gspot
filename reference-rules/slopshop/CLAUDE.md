# Engineering Guidelines

Read [GENERAL.md](rules/general/GENERAL.md) for shared working rules and
[WRITING.md](rules/general/WRITING.md) for all project-authored text. Use the guides relevant
to the files and behavior being changed:

| Area                                                    | Rules                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| Naming, files, and directories                          | [NAMING.md](rules/general/NAMING.md)                            |
| Project documentation                                   | [DOCUMENTATION.md](rules/general/DOCUMENTATION.md)              |
| Bash, Git hooks, and mise tasks                         | [BASH.md](rules/general/BASH.md)                                |
| TypeScript and JavaScript                               | [TYPESCRIPT.md](rules/general/TYPESCRIPT.md)                    |
| Next.js routing, rendering, data access, and deployment | [NEXTJS.md](rules/nextjs/NEXTJS.md)                             |
| Runtime validation and Zod                              | [ZOD.md](rules/nextjs/ZOD.md)                                   |
| React Hook Form                                         | [REACTHOOKFORM.md](rules/nextjs/REACTHOOKFORM.md)               |
| Drizzle database access                                 | [DRIZZLE.md](rules/nextjs/DRIZZLE.md)                           |
| Shared client state                                     | [ZUSTAND.md](rules/nextjs/ZUSTAND.md)                           |
| tRPC procedures and transports                          | [TRPC.md](rules/nextjs/TRPC.md)                                 |
| Queries, hydration, and mutations                       | [TANSTACKQUERY.md](rules/nextjs/TANSTACKQUERY.md)               |
| Messages, locales, and localized navigation             | [INTERNATIONALIZATION.md](rules/nextjs/INTERNATIONALIZATION.md) |
| Application security                                    | [SECURITY.md](rules/nextjs/SECURITY.md)                         |

This is a single-project repository. Preserve the existing quality policies and
follow the verification requirements for the affected scope.

Keep `AGENTS.md` and `CLAUDE.md` aligned. Detailed rules belong in `rules/`.
Only edit these instruction files or the files under `rules/` when explicitly requested.
