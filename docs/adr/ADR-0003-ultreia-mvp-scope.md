# ADR-0003: Ultreia MVP Scope

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is a Camino-specific companion for pilgrims. It is not a deal portal, not a booking replacement, not a generic business directory, and not a marketplace without pilgrim value.

ADR-0001 defines Option C: Ultreia may learn from StepsMatch technically, but remains its own product and repository. ADR-0002 inventories StepsMatch modules as technical reference only.

This ADR defines the first fachlicher MVP scope for Ultreia.

## Decision

The MVP will test the Camino Frances beachhead.

The geographic MVP scope is the full Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela.

The MVP is geographically complete, but functionally still an MVP.

It is explicitly not limited to 3-5 stages.

## Geographic Scope

- Route: full Camino Frances
- Start: Saint-Jean-Pied-de-Port
- Destination: Santiago de Compostela
- Scope: no restriction to a small set of stages

## Important Boundaries

- Geographic scope is complete across the Camino Frances.
- Functional scope remains MVP-level.
- Ultreia gives no guarantee of complete POI coverage.
- Ultreia gives no guarantee of provider coverage.
- Ultreia gives no guarantee of availability, free beds, prices, or opening hours.

## Target Users

- Pilgrims currently walking the Camino Frances
- Pilgrims in concrete travel planning
- First-time pilgrims and pilgrims unfamiliar with the local area

## Preliminary Need Working List

This list is not final. It is a researched working list for MVP thinking, not a final database schema.

### Priority A

- sleep
- eat
- water
- pharmacy
- medical
- grocery
- cash
- stamp
- transport

### Priority B

- laundry
- gear
- toilet
- rest_place
- wifi_mobile

### Priority C

- sightseeing
- church
- viewpoint
- quiet_place
- pilgrim_office
- warning
- bike_info

## Category and Schema Constraint

The need list must not be treated as the final MongoDB category structure.

Before schema decisions, Ultreia needs further research and possibly competitor, forum, and pilgrim-community evaluation.

The data model must be flexible enough to change, merge, split, rename, and reprioritize categories without destructive migrations or product confusion.

## First Content Types

- editorial_place
- official_participating_place
- demo_test_place

## Push and Prompt Principle

Ultreia should use few, relevant prompts. It must avoid a spam perception.

Prompt decisions should consider:

- need
- distance
- route context
- time of day
- opening status
- repetition and suppression state

Initial priority rules:

- Sleep prompts are more relevant later in the day.
- Food prompts are more relevant around eating times.
- Pharmacy and medical help are higher priority.
- Water can become higher priority depending on section, distance, weather, and infrastructure.
- Sightseeing, churches, and viewpoints should usually be quiet or in-app, not aggressive push notifications.

## Success Criteria

- Pilgrims understand the value without a long explanation.
- Pushes are perceived as helpful instead of disruptive.
- Users open relevant prompts.
- Map and navigation are used.
- Editorial hints do not feel like fake partners.
- Battery and background behavior remain acceptable.
- The full Camino Frances scope feels credible as a product promise.

## Abort Signals

- Push spam
- False partner impression
- Unclear need categories
- Excessive battery consumption
- Poor offline or weak-network experience
- Users do not open prompts
- The full Camino feels empty or not credible

## Non-Goals for the MVP

- Booking
- Free-bed guarantee
- Payment
- Provider subscriptions
- Chat
- Reviews
- Social features
- Perfect POI completeness
- Complex provider dashboard
- Automated large-scale POI crawlers without quality control
- Deals or coupons

## Relationship to StepsMatch

StepsMatch provides technical learnings.

Ultreia's MVP scope is not copied from StepsMatch. It is defined specifically for the Camino context, pilgrim UX, and route-based product logic.

No StepsMatch files, product categories, branding, wording, Graz data, or offer/provider logic are adopted by this ADR.

## Consequences

Ultreia must design for a wide route footprint from the beginning while keeping implementation, content density, and product functions intentionally small.

The main MVP challenge is not covering every POI. It is making the full Camino Frances promise credible with selective, useful, clearly labeled content and quiet route-aware prompts.

Next architecture work should define flexible data models for route, stage, place, need, prompt, content source, and prompt visibility before MongoDB schemas are fixed.
