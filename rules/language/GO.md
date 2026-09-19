---
layer: language
preset: go
title: Go
---

# Go

These rules cover Go source, modules, errors, concurrency, and tests.

## Format and layout

- gofmt decides the layout. Do not argue with it, and do not hand-align code it will move.
- One package has one job, and its name says the job in one lowercase word.
- Do not name a package `util`, `common`, `helpers`, `base`, or `misc`. Name it after what it holds.
- Keep `main` thin: parse the flags, build the dependencies, call a function that returns an error.
- Keep a file under the line ceiling and a function under the function ceiling. Split by the job.
- Put the exported identifiers a reader needs first, and the unexported pieces below them.

## Names

- Exported names are MixedCaps and start with a capital. Unexported names start lowercase.
- Do not repeat the package in a name: `http.Client`, never `http.HTTPClient`.
- A receiver name is one or two letters and the same in every method of the type.
- An interface with one method is named for the method with `er`: `Reader`, `Closer`.
- Initialisms keep one case: `userID`, `HTTPServer`, never `userId` or `HttpServer`.

## Errors

- Return an error as the last value. Check it on the next line.
- Never discard an error with `_` unless a comment on that line says why it cannot matter.
- Wrap an error with `%w` and the step that failed: `fmt.Errorf("read config: %w", err)`.
- Compare errors with `errors.Is` and `errors.As`, never with `==` on a wrapped error.
- Do not log an error and return it. Do one of the two, in one place.
- Panic only for a bug that makes the process state unknown. Never panic on bad input.

## Interfaces and types

- Define an interface where it is used, not where it is implemented.
- Accept an interface and return a concrete type.
- Do not add an interface for one implementation only so that a test can replace it.
- The zero value of a type is valid, or a constructor is the only way to build it.
- Do not embed a type to save typing. Embed only when every promoted method belongs to the outer type.

## Concurrency

- Every goroutine has an owner that knows when it ends. Do not start one that nothing waits for.
- Pass a `context.Context` as the first parameter of a function that blocks, and honor its cancellation.
- Never store a context in a struct.
- A channel has one closer, and the closer is the sender.
- Protect shared state with a mutex or give it to one goroutine. Run the tests with the race detector.
- Set a timeout on every outgoing call: HTTP clients, database queries, and dials.

## Modules and dependencies

- `go.mod` and `go.sum` are committed, and `go mod tidy` changes neither.
- Pin tools through the module or the runner, never through `go install ...@latest` in a script.
- Add a dependency only for work the standard library does not do in a few lines.
- govulncheck findings are fixed by an upgrade or recorded with the reason the code path is unreachable.

## Tests

- Table tests name each case, and a failure prints the name, the input, and both values.
- Use `t.Helper()` in a helper, `t.Cleanup` for teardown, and `t.TempDir()` for files.
- Do not sleep in a test. Wait on a channel, a condition, or a fake clock.
- Test the exported behavior of a package from a `_test` package where that is enough.
