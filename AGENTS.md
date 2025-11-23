# Repository Guidelines

This repository is a small static web app. Keep changes minimal, focused, and easy to review.

## Project Structure & Module Organization

- `index.html` – main HTML entry point.
- `style.css` – global styles for all views.
- `main.js` – client-side logic; keep functions small and modular.
- Keep new assets in a top-level `assets/` directory (e.g., `assets/img/`, `assets/fonts/`).

## Build, Test, and Development Commands

This project is plain HTML/CSS/JS with no build step by default.

- Use a simple HTTP server for local dev, e.g. `npx serve .` or `python -m http.server 8000`.
- Open `http://localhost:8000/index.html` in your browser to verify changes.

## Coding Style & Naming Conventions

- Use 2-space indentation for HTML, CSS, and JS.
- Prefer modern JS (`const`/`let`, arrow functions, strict equality).
- Name DOM-related IDs/classes with kebab-case (e.g., `main-header`, `primary-button`).
- Name JS variables and functions in camelCase (e.g., `loadData`, `handleClick`).
- Keep CSS organized by section, with comments for major UI areas.

## Testing Guidelines

- Rely on manual, browser-based testing.
- Test in at least one Chromium-based browser and one other engine when possible.
- Verify core flows (initial load, main interactions, error states) before opening a PR.

## Commit & Pull Request Guidelines

- Write clear, present-tense commit messages (e.g., `Add form validation for email field`).
- Keep commits logically scoped; avoid mixing unrelated changes.
- For PRs, include:
  - A short summary of the change and rationale.
  - Any screenshots or GIFs for UI changes.
  - Notes on testing performed and known limitations.

