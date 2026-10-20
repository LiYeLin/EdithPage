# Repository Guidelines

## Product Vision & UX Principles

Build Edith as a configurable navigation site whose primary distinction is polished, elegant visual effects and interaction. The product should grow through selectable themes and templates rather than a single fixed appearance.

Most future themes and templates are expected to explore 2D-physics-inspired interactions, such as bubbles that collide, merge, separate, or respond to dragging. The current implementation supports only the bubble appearance and its related interactions. Do not describe other physics effects, creative appearances, or a general-purpose physics engine as implemented until they exist.

Use the visual finish of iPhone product pages as the quality benchmark: animation should feel deliberate, fluid, and restrained without reducing navigation speed, readability, accessibility, or responsive behavior. Respect `prefers-reduced-motion` and provide usable fallbacks when an effect is unavailable.

Profession-specific templates and onboarding may be explored later, but their exact options and additional professions remain undefined. Do not assume unconfirmed requirements.

## Project Structure & Module Organization

The repository is a React, TypeScript, and Vite prototype. Keep responsibilities separated using the existing layout:

- `src/` — application source, components, hooks, drag logic, effects, demos, and utilities.
- `tests/` — Node test-runner coverage for bubble layout, highlights, liquid drag, materials, and site movement.
- `public/` — checked-in static assets copied into builds.
- `docs/` — effect specifications and prototype notes.
- `dist/` — generated production output; do not edit it by hand.

Keep modules focused and generated output separate.

## Build, Test, and Development Commands

The prototype uses React, TypeScript, and Vite with npm:

- `npm install` — install dependencies.
- `npm run dev` — start the local development server.
- `npm test` — run the Node-based test suite.
- `npm run lint` — run ESLint.
- `npm run build` — type-check and create the production build.
- `npm run preview` — preview the production build locally.

## Coding Style & Naming Conventions

ESLint is configured for TypeScript and React. Run `npm run lint` before handing off changes. Use two spaces for JSON/YAML and match the established formatter for source files. Prefer descriptive names: `PascalCase` for types/components, `camelCase` for functions and variables, and `kebab-case` for directories and CLI-facing files unless the chosen framework requires another convention.

## Testing Guidelines

Tests use the Node.js test runner with TypeScript type stripping. Add tests under `tests/` and name them after the behavior they verify, such as `bubble-layout.test.ts`. Cover normal behavior, validation failures, reduced-motion or fallback behavior where relevant, and important interaction edge cases. Run `npm test`, `npm run lint`, and `npm run build` before handing off changes.

## Commit & Pull Request Guidelines

Use concise imperative commit subjects, for example `Add navigation search`. Keep commits focused. Pull requests should explain the change, include verification commands and results, link related issues when applicable, and include screenshots or recordings for UI changes.

## Security & Configuration Tips

Do not commit secrets, tokens, private URLs, or local environment files. Provide a sanitized `.env.example` when configuration is introduced, and document required variables without exposing real values.
