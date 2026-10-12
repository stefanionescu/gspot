# Generated Code

- Never edit a generated file by hand. Change the source or the generator and regenerate
  through its generation command.
- Mark generated paths in `.gitattributes` with `linguist-generated`; for example,
  `output/** linguist-generated`. Where the format allows comments, add a header that names the
  generation command. A folder named `generated/` does not make its files generated.
- A generated file equals a fresh run of its command. A difference shows a defect in the change.
- Do not commit build output (`dist/`, `coverage/`, compiled assets) unless the deployment reads
  it from the repository, and then declare it.
