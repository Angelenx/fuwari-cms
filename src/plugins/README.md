# Fuwari Markdown plugins

Adapted from saicaca/fuwari `6d39b0d` so they write `vfile.data` instead of
`data.astro.frontmatter` (this Worker has no Astro `.md` pipeline).

`src/lib/markdown.ts` is the runtime consumer. Admonition / GitHub card /
Expressive Code helpers are not imported yet (`ponytail:` in `markdown.ts`).
