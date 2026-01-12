# [1.7.0](https://github.com/rotorsoft/gent/compare/v1.6.0...v1.7.0) (2026-01-12)


### Features

* add version check to detect and notify users of CLI updates ([32224c1](https://github.com/rotorsoft/gent/commit/32224c1190c71bfcb13150dfee2baa715dbbdcf0)), closes [#27](https://github.com/rotorsoft/gent/issues/27)

# [1.6.0](https://github.com/rotorsoft/gent/compare/v1.5.0...v1.6.0) (2026-01-12)


### Features

* display CLI version in status and help command outputs ([5bd05db](https://github.com/rotorsoft/gent/commit/5bd05dbc4bdab49cc39a89134aab5279f930715c)), closes [#25](https://github.com/rotorsoft/gent/issues/25)

# [1.5.0](https://github.com/rotorsoft/gent/compare/v1.4.0...v1.5.0) (2026-01-12)


### Features

* generate ticket title from CLI command prompt ([7f605e8](https://github.com/rotorsoft/gent/commit/7f605e8fa2f3450101faaebdcd5e649b196fa13f)), closes [#23](https://github.com/rotorsoft/gent/issues/23)

# [1.4.0](https://github.com/rotorsoft/gent/compare/v1.3.2...v1.4.0) (2026-01-11)


### Features

* support dynamic Co-Authored-By trailer ([15e7f58](https://github.com/rotorsoft/gent/commit/15e7f582fcd94864f8e602efd7f0f7212f4698d6))

## [1.3.2](https://github.com/rotorsoft/gent/compare/v1.3.1...v1.3.2) (2026-01-11)


### Bug Fixes

* correct Gemini CLI invocation for interactive implementation mode ([e092920](https://github.com/rotorsoft/gent/commit/e092920c80315276ad7e747a16953e7fdfde9cfa)), closes [#19](https://github.com/rotorsoft/gent/issues/19)

## [1.3.1](https://github.com/rotorsoft/gent/compare/v1.3.0...v1.3.1) (2026-01-11)


### Bug Fixes

* update issue labels to ai-completed after PR creation ([12a119c](https://github.com/rotorsoft/gent/commit/12a119cfb67c672c202233f98ed847f97bd13953)), closes [#17](https://github.com/rotorsoft/gent/issues/17)

# [1.3.0](https://github.com/rotorsoft/gent/compare/v1.2.0...v1.3.0) (2026-01-11)


### Features

* add dynamic provider signature to issues and PRs ([bb51e51](https://github.com/rotorsoft/gent/commit/bb51e517b9e64999a37bbb970ec8045e1921ec12)), closes [#15](https://github.com/rotorsoft/gent/issues/15)

# [1.2.0](https://github.com/rotorsoft/gent/compare/v1.1.2...v1.2.0) (2026-01-11)


### Bug Fixes

* show all providers in status ([d9b6bf7](https://github.com/rotorsoft/gent/commit/d9b6bf7edcf8100cb75364048dd0a3cedef09861))
* show all providers in status ([efc20f8](https://github.com/rotorsoft/gent/commit/efc20f8de5eb67d4a4d4381b68e5b847ad7c08d6))


### Features

* add multi-model AI provider support (Claude + Gemini) ([b2dace4](https://github.com/rotorsoft/gent/commit/b2dace4c093804f1adf4e3627442e2c29e1cb423)), closes [#9](https://github.com/rotorsoft/gent/issues/9)

## [1.1.2](https://github.com/rotorsoft/gent/compare/v1.1.1...v1.1.2) (2026-01-10)


### Bug Fixes

* strip AI preamble from generated ticket bodies ([e52f2f4](https://github.com/rotorsoft/gent/commit/e52f2f462164b3145ebea5d5f8b68ccd3ac6010a)), closes [#10](https://github.com/rotorsoft/gent/issues/10)

## [1.1.1](https://github.com/rotorsoft/gent/compare/v1.1.0...v1.1.1) (2026-01-10)


### Bug Fixes

* replace bordered table with section-based ticket preview ([45bdfdd](https://github.com/rotorsoft/gent/commit/45bdfdd060975f35321017c6c67b675f05bc2ed8)), closes [#11](https://github.com/rotorsoft/gent/issues/11)

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
