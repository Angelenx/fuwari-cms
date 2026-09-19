# Fuwari Markdown plugins

Copied from saicaca/fuwari `6d39b0d`. Excerpt / reading-time are adapted to write
`vfile.data` instead of `data.astro.frontmatter`. Fences are highlighted by
`rehype-expressive-code` in `src/lib/markdown.ts`. Admonition, GitHub card, and
directive helpers are vendored here but not imported
(`ponytail:` they need `rehype-components` + Fuwari theme markup).
