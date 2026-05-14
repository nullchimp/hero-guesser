---
name: hero-guesser-open-source
description: Project-specific open source best-practices guidance for Hero Guesser. Use when preparing this repository for public release or ongoing stewardship: README/license/contributing/security docs, dependency and attribution hygiene, issue/PR workflows, CI expectations, release notes, responsible asset/data handling for superhero or villain names, and repository health checks.
---

# Hero Guesser Open Source

## Goal

Make Hero Guesser welcoming, legally tidy, and maintainable as an open source project without adding ceremony the repo does not yet need.

## Workflow

1. Inspect the current repo state before recommending changes: README, license, package manifests, tests, CI, docs, assets, data files, generated files, and ignored files.
2. Classify the maturity level: prototype, public alpha, stable public project, or maintained community project.
3. Patch the smallest useful set of project files for that maturity level.
4. Verify links, commands, examples, and contributor instructions against the actual repo.
5. Leave open decisions explicit when they require owner judgment, especially license choice, project governance, and trademark-sensitive data.

## Open Source Checklist

Prioritize these items for a small app:

- README that explains what Hero Guesser does, how to run it, how to test it, and what technologies it uses.
- Clear license file or an explicit note that no license has been chosen yet.
- Contribution path with local setup, test commands, coding expectations, and how to propose changes.
- Security policy with a private reporting route placeholder when no contact exists yet.
- Code of conduct only when the user wants community contributions or public collaboration.
- Dependency hygiene: lockfiles committed when appropriate, unused packages removed, known vulnerabilities surfaced, engines documented if needed.
- CI that runs install, lint/typecheck, and tests once the project has those commands.
- Issue and PR templates only when they reduce repeated project-maintainer work.
- Changelog or release notes only once versions/releases exist.

## Hero Guesser Specific Risks

Treat superhero and villain names, images, logos, character descriptions, and franchise metadata carefully:

- Prefer user-supplied, original, public-domain, or clearly licensed datasets and assets.
- Do not add copyrighted character art, logos, trading-card text, wiki dumps, or proprietary datasets without a license trail.
- Avoid presenting trademarks or franchise names as project ownership or endorsement.
- Add attribution files when third-party assets, datasets, fonts, or icons are used.
- Keep secrets, API tokens, analytics keys, and private datasets out of the repo.

## Output Expectations

When performing an open source pass:

- Start with concrete repo changes when the user asked for implementation.
- Summarize unresolved owner decisions separately from completed fixes.
- Keep docs concise and useful for a first-time contributor.
- Do not invent legal conclusions; flag legal or licensing uncertainty plainly.
