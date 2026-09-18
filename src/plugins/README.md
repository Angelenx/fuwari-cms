# Fuwari Markdown plugins

Copied from saicaca/fuwari `6d39b0d`. Excerpt / reading-time are adapted to write
`vfile.data` instead of `data.astro.frontmatter`. Admonition, GitHub card, and
directive helpers are vendored here but not imported by `src/lib/markdown.ts`
(`ponytail:` they need `rehype-components` + Fuwari theme markup).
