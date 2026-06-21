# ADR-0004: Need Category Research

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is a Camino-specific companion for pilgrims. It is not a deal portal, not a booking replacement, and not a generic provider marketplace.

ADR-0003 defines the MVP scope as the full Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela. The goal is to support pilgrims on the way with a small number of relevant prompts without creating a spam perception.

Before MongoDB structures are fixed, Ultreia needs a fachlich researched need and category taxonomy. This ADR documents the working taxonomy only. It does not define a database schema.

## Research Basis

The working taxonomy is based on the following product research assumptions:

- Existing Camino apps tend to focus on route, stages, accommodation, services, monuments, warnings, offline maps, and practical information.
- Official or near-official Camino information commonly references health centers, pharmacies, hospitals, contact information, and opening hours.
- Pilgrim forums show strong recurring topics around water and hydration, first aid and blisters, medical help and injuries, health, and fitness.
- Accommodation, food, water, pharmacy, medical help, grocery, cash/ATM, and stamps are core pilgrim needs.
- Laundry, transport, gear, toilet, and rest places are real needs, but need more nuanced prompt rules.
- Sightseeing, churches, viewpoints, quiet places, and bike information are usually lower-noise or in-app categories.
- Warnings are valuable, but carry high responsibility because timeliness and trust matter. They must not be treated as simple POIs.

## Decision

Ultreia will think about early content classification as a combination of:

- NeedCategory
- PlaceType
- PushSuitability
- DataRisk

This is a fachlich prioritized taxonomy, not a final MongoDB schema and not a final data structure.

The data model must remain flexible enough to change, merge, split, rename, and reprioritize categories after further research.

Push rules must differ by need. A pharmacy prompt, a water prompt, a church hint, and a warning cannot use the same push logic.

Availability, opening hours, prices, and free beds must never be guaranteed.

Editorial hints must remain clearly separated from official participating places.

After this ADR, Ultreia needs a separate ADR for data model and schema design.

## MVP Core Needs

### sleep

- NeedCategory: `sleep`
- Typical PlaceTypes: `albergue`, `hostel`, `pension`, `hotel`, `rural_house`, `camping`
- PushSuitability: `time_windowed`
- DataRisk: high
- Reason: Sleep is one of the strongest Camino needs, but availability, prices, opening status, and booking state are sensitive. Ultreia must not imply free-bed guarantees or booking certainty.

### food

- NeedCategory: `food`
- Typical PlaceTypes: `bar`, `cafe`, `restaurant`, `bakery`
- PushSuitability: `time_windowed`
- DataRisk: medium
- Reason: Food is highly relevant around meal times and after long sections, but opening hours and day-specific availability can be wrong.

### water

- NeedCategory: `water`
- Typical PlaceTypes: `fountain`, `water_point`, `cafe`, `bar`
- PushSuitability: `contextual_push`
- DataRisk: medium/high
- Reason: Water can become important depending on section, weather, distance, and infrastructure. Fountain or water point status can be uncertain and must be presented carefully.

### pharmacy

- NeedCategory: `pharmacy`
- Typical PlaceTypes: `pharmacy`
- PushSuitability: `high_when_selected`
- DataRisk: medium/high
- Reason: Pharmacy access is valuable for blisters, pain, minor injuries, and medication, but opening hours and night-duty pharmacies are volatile.

### medical_help

- NeedCategory: `medical_help`
- Typical PlaceTypes: `health_center`, `clinic`, `hospital`, `emergency_service`
- PushSuitability: `high_when_selected_or_emergency_context`
- DataRisk: high
- Reason: Medical help is high-value and high-responsibility. Information must be current, carefully worded, and should avoid any claim of medical advice or guaranteed service.

### grocery

- NeedCategory: `grocery`
- Typical PlaceTypes: `supermarket`, `grocery_store`, `tienda`
- PushSuitability: `contextual_push`
- DataRisk: medium
- Reason: Grocery stops are practical before longer or thinner infrastructure sections, especially before closing times.

### cash

- NeedCategory: `cash`
- Typical PlaceTypes: `atm`, `bank`
- PushSuitability: `low_or_contextual`
- DataRisk: medium
- Reason: Cash access matters in smaller places, but ATM availability and functionality can change. It is usually not a high-frequency push need.

### stamp

- NeedCategory: `stamp`
- Typical PlaceTypes: `albergue`, `church`, `bar`, `tourism_office`, `pilgrim_office`
- PushSuitability: `low/contextual`
- DataRisk: low/medium
- Reason: Stamps are culturally important for pilgrims, but usually better as map/in-app information unless the user explicitly cares about them.

## Secondary Needs

### transport

- NeedCategory: `transport`
- Typical PlaceTypes: `bus_stop`, `taxi`, `train_station`, `luggage_transport`
- PushSuitability: `contextual_or_problem_case`
- DataRisk: high
- Reason: Transport can be critical when injured, tired, delayed, or changing plans. Timetables, availability, and operator responsibility are volatile.

### laundry

- NeedCategory: `laundry`
- Typical PlaceTypes: `laundromat`, `accommodation_laundry`
- PushSuitability: `in_app_or_time_windowed`
- DataRisk: medium/high
- Reason: Laundry is a real recurring pilgrim need, but availability and access often depend on accommodation rules or opening times.

### gear

- NeedCategory: `gear`
- Typical PlaceTypes: `pharmacy`, `outdoor_shop`, `shoe_store`, `sports_shop`
- PushSuitability: `contextual`
- DataRisk: medium
- Reason: Gear is useful when equipment fails, but broad gear prompts can become noisy and should remain contextual.

### toilet

- NeedCategory: `toilet`
- Typical PlaceTypes: `public_toilet`, `cafe`, `bar`, `accommodation`
- PushSuitability: `in_app`
- DataRisk: high
- Reason: Toilet information is useful but hard to verify. Access can depend on customers-only rules, opening hours, or local conditions.

### rest_place

- NeedCategory: `rest_place`
- Typical PlaceTypes: `bench`, `picnic_area`, `shade`, `park`, `quiet_spot`
- PushSuitability: `in_app_or_low`
- DataRisk: medium/high
- Reason: Rest places support walking comfort and pacing, but quality, shade, access, and current condition can vary.

### wifi_mobile

- NeedCategory: `wifi_mobile`
- Typical PlaceTypes: `cafe`, `accommodation`, `telecom_shop`
- PushSuitability: `in_app`
- DataRisk: medium/high
- Reason: Connectivity is useful for planning and contacting others, but Wi-Fi quality, passwords, and mobile service state are not reliably guaranteed.

## Discovery / Low-Noise Needs

The following needs should primarily appear in-app:

- `sightseeing`
- `church`
- `viewpoint`
- `quiet_place`
- `pilgrim_office`
- `bike_info`

They may support optional quiet hints, but should not use aggressive push notifications.

Push for these categories should only happen when explicitly activated by the user or when there is a special context that clearly justifies interruption.

## Controlled / Later

### warning

- NeedCategory: `warning`
- Description: Warning content must not be treated as a simple POI.
- Model implication: It needs an incident or advisory model.
- Responsibility: High, because timeliness, source quality, and user trust matter.
- MVP rule: Include only if source and responsibility are clear.

Warnings may involve route closures, hazards, severe weather, service disruptions, or safety-relevant notices. These require source tracking, timestamps, expiry, severity, affected route segment, and clear editorial responsibility.

## Data and Product Constraints

- No MongoDB schema is defined by this ADR.
- No final data structures are defined by this ADR.
- Need categories are fachlich prioritized but still subject to change.
- Place types are examples and may expand or merge.
- PushSuitability is a decision input, not final push logic.
- DataRisk must influence wording, display prominence, freshness checks, and whether a push is allowed.
- Editorial places and official participating places must stay visibly distinct.
- Demo/test places must never be confused with real official partners.

## Consequences

The next architecture decision should define the data model and schema approach for Ultreia.

That schema should support flexible NeedCategory, PlaceType, PushSuitability, DataRisk, source type, freshness, route segment, language, and content status without hard-coding today's working list as irreversible structure.

Until then, this taxonomy is the fachliche basis for product discussion, content planning, and schema design.
