# ADR-0001: Technical Bootstrap from StepsMatch

Status: Accepted
Date: 2026-06-21

## Context

Ultreia.app is an independent Camino product for pilgrims. It must stay clearly separated from StepsMatch.com in repository, product logic, brand, language, data, roadmap, commits, deployments, risks, todos, and operational context.

StepsMatch.com remains the technical lab. It can provide proven technical building blocks and lessons learned, but it is not the operative source of truth for Ultreia.

The key architecture choice is Option C: selective technical bootstrap from StepsMatch without full copy, rebranding, or blind product transfer.

## Decision

Ultreia remains its own repository and its own product.

Ultreia will selectively adopt proven technical building blocks and learnings from StepsMatch where they are useful for the Camino context.

Ultreia will not follow a full-copy or rebranding strategy.

Ultreia will not adopt StepsMatch branding, Graz demo data, StepsMatch categories, StepsMatch wording, or unchecked offer/provider logic.

Every technical adoption from StepsMatch must be consciously reviewed before use:

- Does it fit the Camino context?
- Does it fit the pilgrim UX?
- Does it fit route and stage logic?
- Is it technically stable enough?

## First Adoption Candidates

The first technical areas that may be reviewed for adoption are:

- Background Location
- Heartbeat
- PushToken registration
- Local/Remote Push
- Map/Directions
- Express/Mongo base structure
- Auth/User base patterns, if useful
- Logging/Diagnostics
- Match Reasons
- Notification Throttling

## Explicit Non-Adoptions

The following must not be adopted blindly:

- StepsMatch wording
- StepsMatch categories
- Graz/Judendorf test data
- Provider/Offer UX without Camino review
- Radius-only logic as the final Ultreia model
- Technical legacy or accidental complexity

## Consequences

Ultreia can move faster by reusing proven technical knowledge without inheriting the wrong product assumptions.

Every imported pattern remains conditional. It must earn its place in Ultreia by matching the Camino route context, pilgrim needs, notification discipline, and long-term product boundary.

This ADR makes the separation from StepsMatch explicit while still allowing pragmatic technical learning.
