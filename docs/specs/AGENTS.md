# Spec Conventions

This directory holds one spec per plugin. Specs are the contract between intent and implementation: every behavioral decision lands here, and the code follows.

## File Layout

- One spec per plugin: `docs/specs/<plugin-name>-spec.md`, matching `packages/<plugin-name>`.
- The spec owns behavior. When a decision changes what the plugin does, update the spec in the same change as the code. A spec that lags the implementation is a defect.
- Read the spec before changing plugin behavior, and after reading it, trust it over chat history. Resolutions recorded here supersede anything decided conversationally.

## What Goes In A Spec

Requirements that hold across refactors, and nothing else:

- Plugin inputs: options the plugin accepts, their defaults, and their validation rules.
- Behavioral rules: observable behavior, stated deterministically. Every rule should read as testable - if a rule cannot be verified from the outside, it is not a requirement, it is a wish.
- Failure handling: what fails, what each failure costs, and what the plugin does anyway. State the failure philosophy explicitly (for example: fail open, never block the host).
- Surfaces: RPC contracts, config file formats, and anything another plugin or user consumes.
- Deferred work: a `Future` section for decided-but-unbuilt behavior, so intent is not lost.

Keep implementation out: no module layout, no build steps, no package versions, no plans or task lists. Those rot; requirements do not.

## Style

- Follow the writing conventions in the user's global AGENTS.md: ASCII only, no em dashes, no smart quotes, impersonal voice.
- Prefer examples over prose for formats (config shapes, file layouts). An example is a requirement a reader cannot misread.
- When two rules could collide, resolve the collision in the spec with an explicit precedence rule rather than leaving both standing.

## Pattern To Follow

`config-spec.md` is the reference example of this style: inputs first, then rules grouped by concept, an explicit failure taxonomy, a complete state list, and the RPC surface stated as input/output pairs. New specs should be recognizable as siblings of it.
