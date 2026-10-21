# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project foundation: repository files, pinned tooling, ESLint and Prettier configuration,
  continuous integration, GitHub Pages and Firebase workflows, and architecture decision records.

### Fixed

- The request form on a developer's page no longer fails to restore a saved draft. The error
  "state.fields.write is not a function" stopped the page from loading the form.

### Added

- Developers can edit their own profile on their page: display name, bio, website, pricing note,
  the platforms they build for (built-in and their own), and whether they accept requests. The
  username cannot change.
- Developers can tick "I use AI to write code" on their profile. The flag is stored as `usesAi`.
  Firestore rules change with it, so the rules must be deployed before the profile form is used.

### Changed

- The request budget is a range of whole numbers, entered as "from" and "to", in place of fixed
  bands. Zero to zero means free. The budget filter is removed, and sorting by budget uses the top
  of the range. Firestore rules change with it (`budgetMin` and `budgetMax` replace `budgetRange`),
  so the rules must be deployed before the app. See ADR 0017.
