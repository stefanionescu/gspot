# Generated Code

Read this rule when you change a generated file, or the code that writes one.

- Never edit a generated file by hand. Change the source or the generator and regenerate
  through its generation command.
- Mark generated paths in `.gitattributes` with `linguist-generated`; for example,
  `output/** linguist-generated`. Where the format allows comments, add a header that names the
  generation command. A folder named `generated/` does not make its files generated.
- A generated file equals a fresh run of its command. A difference shows a defect in the change.
- Do not commit build output (`dist/`, `coverage/`, compiled assets) unless the deployment reads
  it from the repository, and then declare it.

## Readable output

- Where the format allows comments, start the file with a header. Name the generator and the command that writes
  the file. Add one line that states the file's purpose.
- Group the entries of a generated list, such as an ignore file, under a comment that states their purpose, with
  one group for each source. Write each entry once.
- Write one entry per line, in a stable order. Use the formatter's layout.
- Keep code that a program runs in a source file that the checks read, not in a string inside the generator.
