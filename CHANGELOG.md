# [1.1.0](https://github.com/rotorsoft/gent/compare/v1.0.2...v1.1.0) (2026-01-10)


### Bug Fixes

* add progress.txt update instruction to implementation workflow ([8f9a5b9](https://github.com/rotorsoft/gent/commit/8f9a5b995c05032795fa1e7d6903c1586ff8ce78)), closes [#4](https://github.com/rotorsoft/gent/issues/4)


### Features

* add progress indicator and approval flow to create command ([a4f681e](https://github.com/rotorsoft/gent/commit/a4f681ed9d2fb732788682da064ffcd6adb485a6)), closes [#4](https://github.com/rotorsoft/gent/issues/4)

## [1.0.2](https://github.com/rotorsoft/gent/compare/v1.0.1...v1.0.2) (2026-01-10)


### Bug Fixes

* align box borders by using template literals instead of console.log args ([e1b2a0e](https://github.com/rotorsoft/gent/commit/e1b2a0e5e5d53d37487febde5580cb92fdc02aeb)), closes [#3](https://github.com/rotorsoft/gent/issues/3)

## [1.0.1](https://github.com/rotorsoft/gent/compare/v1.0.0...v1.0.1) (2026-01-10)


### Bug Fixes

* only set ai-completed label when commits are created ([9e3140c](https://github.com/rotorsoft/gent/commit/9e3140c12d294669afa1ba6eb7c261103fb0397c)), closes [#2](https://github.com/rotorsoft/gent/issues/2)

# 1.0.0 (2026-01-10)


### Bug Fixes

* add missing @eslint/js dependency for ESLint 9 flat config ([88c57b2](https://github.com/rotorsoft/gent/commit/88c57b28cf12db7c21096496a6d70133bd3767c4)), closes [#1](https://github.com/rotorsoft/gent/issues/1)
* claude output piped ([cc07cd3](https://github.com/rotorsoft/gent/commit/cc07cd3f86a9782545098fbc5eb95c96c3345b1c))
* eslint ([c110f84](https://github.com/rotorsoft/gent/commit/c110f84b0a687c6882055041123dfeeca78869b5))
* self gent init ([6425228](https://github.com/rotorsoft/gent/commit/64252289a6753d9cd7e2827edd6f34d8a447ca5a))
* show claude output ([11dafe7](https://github.com/rotorsoft/gent/commit/11dafe73a928685236ee7d3d0f5f9013ea6fe475))
* try with spawn ([12adbf3](https://github.com/rotorsoft/gent/commit/12adbf3d13513c6dc6aae16f53ea6f10af24c1af))


### Features

* initial release of @rotorsoft/gent ([a3c1c6c](https://github.com/rotorsoft/gent/commit/a3c1c6c5c0506edeffed39c2c1380d8688acaa6b))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of @rotorsoft/gent
- `gent init` - Initialize gent workflow in repository
- `gent setup-labels` - Setup GitHub labels for AI workflow
- `gent create` - Create AI-enhanced GitHub issues
- `gent list` - List issues by label/status
- `gent run` - Run Claude to implement issues
- `gent pr` - Create AI-enhanced pull requests
- `gent status` - Show current workflow status
