---
layer: language
preset: rust
title: Rust
---

# Rust

These rules cover Rust source, errors, ownership, unsafe code, crates, and tests.

## Format and layout

- rustfmt decides the layout. Do not hand-align code it will move.
- One module has one job. Split a module by the job when it passes the line ceiling.
- Keep `main` thin: parse the arguments, build the dependencies, call a function that returns a `Result`.
- Public items carry a doc comment that says what the item is for, not what its name already says.
- Put the public items a reader needs first, and the private pieces below them.

## Errors

- A function that can fail returns a `Result`. It does not panic, and it does not return a sentinel value.
- Do not call `unwrap` or `expect` outside tests. Propagate with `?`, or handle the error where it arrives.
- An `expect` in a test, or on an invariant the line above proves, carries a message that states the invariant.
- A library defines its own error type with one variant for each way it fails. An application may use a boxed error at the top.
- Add context where an error crosses a boundary: the file that did not open, the key that was absent.
- Do not leave `todo!`, `unimplemented!`, or `dbg!` in committed code.

## Ownership and types

- Take `&str` and `&[T]` in a parameter, not `&String` and `&Vec<T>`.
- Clone because the design needs a second owner, never to quiet the borrow checker.
- Make an invalid state impossible to build: a private field and a constructor that validates.
- Wrap a primitive that has a meaning in a newtype: a `UserId` is not any `u64`.
- Derive `Debug` on every public type. Derive `Clone`, `PartialEq`, and `Eq` where they are true of the type.
- Match every variant of an enum the crate owns. A wildcard arm hides the variant added next year.

## Unsafe code

- Do not write `unsafe` where a safe construct does the work.
- Every `unsafe` block carries a `SAFETY:` comment that says why each requirement of the operation holds.
- Keep an `unsafe` block as small as the operation, and wrap it in a safe function that upholds its invariants.
- A crate that needs no `unsafe` says so with `#![forbid(unsafe_code)]`.

## Concurrency

- Do not block inside async code: no `std::thread::sleep`, no blocking file or network call, no long computation.
- Do not hold a lock across an `.await`.
- Every spawned task has an owner that joins it or cancels it.
- Share state through a channel or an `Arc` around a lock, and keep the locked section short.

## Crates and dependencies

- `Cargo.lock` is committed for an application and for a library alike, so every machine builds what the author built.
- Add a dependency only for work the standard library does not do in a few lines.
- Turn off default features a crate does not need, and name the features it does.
- An advisory from cargo-audit is fixed by an upgrade, or recorded with the reason the code path is unreachable.
- cargo-deny decides which licenses and which registries the crate graph may hold.

## Tests

- Unit tests sit in a `tests` module beside the code. Tests of the public interface sit under `tests/`.
- A test name says the behavior and the condition, not the function under test.
- Do not sleep in a test. Wait on a channel, a condition, or a paused clock.
- A doc example compiles and runs, because `cargo test` runs it.
