# Repository Guidelines

## Product Vision & UX Principles

Build a navigation site with selectable templates and moderate configuration. Include an onboarding page where users choose profession-specific templates, such as programmer or accountant.

The defining feature is polished frontend animation and visual effects, with iPhone product pages as the quality benchmark. Treat this as a design target, not an implemented capability. The exact configuration options and additional professions remain to be defined; do not assume unconfirmed requirements.

## Project Structure & Module Organization

This repository is currently an empty scaffold: it contains Git metadata but no source, test, asset, or build directories yet. As the project grows, keep responsibilities separated with a predictable layout:

- `src/` — application or library source code.
- `tests/` — automated tests, mirroring the relevant `src/` paths.
- `public/` or `assets/` — static files and other checked-in resources.
- `scripts/` — repeatable development and maintenance utilities.
- `docs/` — architecture notes and contributor-facing documentation.

Keep modules focused and generated output separate.

## Build, Test, and Development Commands

The prototype uses React, TypeScript, and Vite with npm:

- `npm install` — install dependencies.
- `npm run dev` — start the local development server.
- `npm run lint` — run ESLint.
- `npm run build` — type-check and create the production build.
- `npm run preview` — preview the production build locally.

## Coding Style & Naming Conventions

ESLint is configured for TypeScript and React. Run `npm run lint` before handing off changes. Use two spaces for JSON/YAML and match the established formatter for source files. Prefer descriptive names: `PascalCase` for types/components, `camelCase` for functions and variables, and `kebab-case` for directories and CLI-facing files unless the chosen framework requires another convention.

## Testing Guidelines

No automated test framework or coverage threshold is configured yet. When introducing tests, use `tests/` or the framework’s conventional directory and mirror source structure. Name tests after the behavior they verify, such as `navigation-menu.test.ts`. Cover normal behavior, validation failures, and important edge cases. Run the full test command before opening a pull request.

## Commit & Pull Request Guidelines

There is no Git history yet, so no existing commit convention can be inferred. Use concise imperative commit subjects, for example `Add navigation search`. Keep commits focused. Pull requests should explain the change, include verification commands and results, link related issues when applicable, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Do not commit secrets, tokens, private URLs, or local environment files. Provide a sanitized `.env.example` when configuration is introduced, and document required variables without exposing real values.
