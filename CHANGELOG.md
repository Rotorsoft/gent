## [1.14.1](https://github.com/rotorsoft/gent/compare/v1.14.0...v1.14.1) (2026-01-30)


### Bug Fixes

* refactor modals ([120c1dc](https://github.com/rotorsoft/gent/commit/120c1dc1fbe4d38247bf05e85b45b62f63f8a2da))
* skip dashboard refresh when modal is cancelled ([3671321](https://github.com/rotorsoft/gent/commit/367132163c042e50956e1895d435df2299f486be))
* skip full refresh for lightweight actions, remove Video setting ([26839d9](https://github.com/rotorsoft/gent/commit/26839d9d2dde428063c07ea847937e1f548d9448))
* truncate modal content that overflows frame width ([642abd6](https://github.com/rotorsoft/gent/commit/642abd6c7732fc14f9edb1e6a07204cd029ce129))

# [1.14.0](https://github.com/rotorsoft/gent/compare/v1.13.4...v1.14.0) (2026-01-29)


### Features

* remove video command from TUI and suggest video after PR creation ([8e4a0b0](https://github.com/rotorsoft/gent/commit/8e4a0b08991d0e188e08eb49ebde6af1f8cbaa87)), closes [#62](https://github.com/rotorsoft/gent/issues/62)

## [1.13.4](https://github.com/rotorsoft/gent/compare/v1.13.3...v1.13.4) (2026-01-29)


### Bug Fixes

* continue after run ([138558c](https://github.com/rotorsoft/gent/commit/138558c5d761e85a59ba667b68278688616b52a4))
* lint errors in test ([d4ec98d](https://github.com/rotorsoft/gent/commit/d4ec98d0ffc1a1456b813cf77dadfeb6c84c89db))

## [1.13.3](https://github.com/rotorsoft/gent/compare/v1.13.2...v1.13.3) (2026-01-29)


### Bug Fixes

* remove duplicate settings section in TUI on main branch ([aaaf3bc](https://github.com/rotorsoft/gent/commit/aaaf3bc76f73e16d86a600918f552f4a24fe2956)), closes [#56](https://github.com/rotorsoft/gent/issues/56)

## [1.13.2](https://github.com/rotorsoft/gent/compare/v1.13.1...v1.13.2) (2026-01-29)


### Bug Fixes

* ask for commit with ai or manually, and format all code with repository rules ([4091de7](https://github.com/rotorsoft/gent/commit/4091de79fc86bb736c15237492a905f58ada3162))
* command labels and shorcuts ([5ae32ff](https://github.com/rotorsoft/gent/commit/5ae32ffe18f0e4f422fbae10d04803958ea3e4a2))
* move refresh label to commands section ([1b5e8a7](https://github.com/rotorsoft/gent/commit/1b5e8a77d772aa248a57e25b7ae108cd9f14fa0a))
* move settings to top ([5e2c54c](https://github.com/rotorsoft/gent/commit/5e2c54c8b737c618afcf1bede2ea478abecce8b6))
* simplify command labels and shortcuts, but making this commit message larger than usual to test trimming in the commit section ([94a712a](https://github.com/rotorsoft/gent/commit/94a712a781d8bf34fa4468d9726cbf9ba6308b63))
* trim commit msgs ([c229eae](https://github.com/rotorsoft/gent/commit/c229eae1949a721d67d7398b47ee18425ffee595))
* unit test with new shortcuts ([916d6da](https://github.com/rotorsoft/gent/commit/916d6daf67e7e651071d981b64e0827b52651656))
* use TUI state before config ([d60048f](https://github.com/rotorsoft/gent/commit/d60048f17a14d764d2a2adb999ba5f7d1012fd30))

## [1.13.1](https://github.com/rotorsoft/gent/compare/v1.13.0...v1.13.1) (2026-01-29)


### Bug Fixes

* hide implement action for merged PRs and replace refresh modal with inline indicator ([a2c77e0](https://github.com/rotorsoft/gent/commit/a2c77e073856c25eeb65a2c0b060d9b418ccae92)), closes [#53](https://github.com/rotorsoft/gent/issues/53)

# [1.13.0](https://github.com/rotorsoft/gent/compare/v1.12.1...v1.13.0) (2026-01-29)


### Bug Fixes

* make list action available on feature branches too ([d16b973](https://github.com/rotorsoft/gent/commit/d16b973f0f67a1155d4e2d88075681a936bb8d13))


### Features

* replace "run next" with interactive ticket selector for branch switching ([0a493aa](https://github.com/rotorsoft/gent/commit/0a493aaee0ea15ac50e73e9872a2be6f27569657)), closes [#51](https://github.com/rotorsoft/gent/issues/51)

## [1.12.1](https://github.com/rotorsoft/gent/compare/v1.12.0...v1.12.1) (2026-01-29)


### Bug Fixes

* differentiate three implementation scenarios in TUI ([9048669](https://github.com/rotorsoft/gent/commit/9048669959fdafa0d239b40cc6c3d8cef96fac84))
* keep provider switch in-memory to avoid dirtying the repo ([486e136](https://github.com/rotorsoft/gent/commit/486e136fd74ebeb8518beccc08126dadef73f753))
* replace fix-feedback command with context-aware implementation agent ([112b5bd](https://github.com/rotorsoft/gent/commit/112b5bdc52b64b56a066d3fb909e0625f5537b69))
* standardize TUI command execution and modal dialogs ([9a2ceb9](https://github.com/rotorsoft/gent/commit/9a2ceb97b9bee1f529bd6d676bca29ca911e90d5)), closes [#49](https://github.com/rotorsoft/gent/issues/49)

# [1.12.0](https://github.com/rotorsoft/gent/compare/v1.11.0...v1.12.0) (2026-01-28)


### Bug Fixes

* redesign dashboard as single bordered frame with section dividers ([ccc5a7c](https://github.com/rotorsoft/gent/commit/ccc5a7c72b35e8e708af7445dc7c43c2195df068))
* remove always-visible "continue impl" action from dashboard ([7b42f3f](https://github.com/rotorsoft/gent/commit/7b42f3fb822e72bc4f23d4b2b8a173336359acef))
* show descriptions in ticket/PR panels and move commands into frame ([e49964d](https://github.com/rotorsoft/gent/commit/e49964d9444a4976734ac5b2c0f343710b4abc43))
* strip backticks and code fences from AI commit messages ([fe3f15c](https://github.com/rotorsoft/gent/commit/fe3f15c830e3a1321c1f758797f46f1bb731b45e))
* use Commander default action for dashboard instead of argv check ([b46503e](https://github.com/rotorsoft/gent/commit/b46503e7adb2ac4322e594d5542e79fd5f769685))
* use unique case-sensitive shortcuts for push (P) and create pr (C) ([ae6e35c](https://github.com/rotorsoft/gent/commit/ae6e35cd8beb8b1b340137dbe0dfd797beed83f7))


### Features

* add interactive dashboard with context-aware workflow actions ([0c65d5a](https://github.com/rotorsoft/gent/commit/0c65d5a11d556b6dbd7eb559531f4ed69803b9b3)), closes [#47](https://github.com/rotorsoft/gent/issues/47)

# [1.11.0](https://github.com/rotorsoft/gent/compare/v1.10.1...v1.11.0) (2026-01-26)


### Features

* add Playwright video capture for UI changes in PRs ([9383283](https://github.com/rotorsoft/gent/commit/938328326006db8f1e832a11c65423ddfb045ed5)), closes [#45](https://github.com/rotorsoft/gent/issues/45)

## [1.10.1](https://github.com/rotorsoft/gent/compare/v1.10.0...v1.10.1) (2026-01-15)


### Bug Fixes

* remove duplicate update check from status command ([1e2fd02](https://github.com/rotorsoft/gent/commit/1e2fd02e37cb120a95ae45e127c706b267a86e59)), closes [#41](https://github.com/rotorsoft/gent/issues/41)

# [1.10.0](https://github.com/rotorsoft/gent/compare/v1.9.2...v1.10.0) (2026-01-15)


### Features

* enhance status command to show PR state and actionable review feedback ([7854b7d](https://github.com/rotorsoft/gent/commit/7854b7d5975a4acc8100c9b90f8c015093291796)), closes [#39](https://github.com/rotorsoft/gent/issues/39)
* show actionable comments summary in status command ([009539a](https://github.com/rotorsoft/gent/commit/009539a1e10919f3b51d4c8e44ead91bdb21043b))

## [1.9.2](https://github.com/rotorsoft/gent/compare/v1.9.1...v1.9.2) (2026-01-14)


### Bug Fixes

* ignore outdated comments ([63b3655](https://github.com/rotorsoft/gent/commit/63b365525ebbf68e20fb61dd01035a7cb46685f1))

## [1.9.1](https://github.com/rotorsoft/gent/compare/v1.9.0...v1.9.1) (2026-01-14)


### Bug Fixes

* use GraphQL API for PR review threads and add timestamp filtering ([68f3a21](https://github.com/rotorsoft/gent/commit/68f3a21f9c1f78be1db63d19e44735ebf1359fcd)), closes [#35](https://github.com/rotorsoft/gent/issues/35)

# [1.9.0](https://github.com/rotorsoft/gent/compare/v1.8.0...v1.9.0) (2026-01-14)


### Features

* add gent fix command for review feedback ([78008f0](https://github.com/rotorsoft/gent/commit/78008f09fd6b7c14c77319b13d23d133af7c811d)), closes [#33](https://github.com/rotorsoft/gent/issues/33)

# [1.8.0](https://github.com/rotorsoft/gent/compare/v1.7.1...v1.8.0) (2026-01-14)


### Bug Fixes

* update references from OpenAI to Codex in documentation and code ([b9ce497](https://github.com/rotorsoft/gent/commit/b9ce497d0ddec51f07e7ddc37898e4ce5ff8a1b9))


### Features

* add support for OpenAI Codex as an AI provider ([fd39d4f](https://github.com/rotorsoft/gent/commit/fd39d4f99087531cb93132d9d05e1f2fc8b6d485))
* add support for OpenAI Codex as an AI provider ([b1839ba](https://github.com/rotorsoft/gent/commit/b1839bacd4cc16e9fb9691cd7cb7bb20b217b6f8)), closes [#31](https://github.com/rotorsoft/gent/issues/31)

## [1.7.1](https://github.com/rotorsoft/gent/compare/v1.7.0...v1.7.1) (2026-01-12)


### Bug Fixes

* version ([4a9cc89](https://github.com/rotorsoft/gent/commit/4a9cc893f6a546665d6a21cd7038843a1650f611))

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
