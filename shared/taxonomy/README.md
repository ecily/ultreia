# Ultreia Shared Taxonomy

This directory contains the current shared technical taxonomy baseline for
Ultreia.

The files are consumed centrally by backend, mobile, and frontend. They are not
a MongoDB schema and do not define persistence or runtime environment values.
The broader fachliche V1-Need-Definition is in
`docs/ULTREIA_V1_PRODUCT_SPEC.md`; the final catalog remains centrally
admin-managed and must not be duplicated in clients.

## Files

- `languages.json`: supported languages.
- `needCategories.json`: pilgrim needs and their default push suitability.
- `placeTypes.json`: concrete place types and their related needs.
- `contentTypes.json`: editorial, official participating, and demo/test content boundaries.
- `trustLabels.json`: labels for source and trust state.
- `pushSuitability.json`: shared push suitability vocabulary.
- `validate-taxonomy.mjs`: dependency-free validation script.

## Rules

- All system labels must include complete `de`, `en`, and `es` values.
- This rule applies to languages, NeedCategories, PlaceTypes, ContentTypes, TrustLabels, and PushSuitability.
- Provider-generated content may later have translation gaps; system labels must not.
- These files must not contain secrets.
- These files must not contain StepsMatch data.
- Changes to NeedCategories, PlaceTypes, ContentTypes, TrustLabels, and PushSuitability must be deliberate and documented through project context or ADRs when relevant.

## Validation

Run:

```bash
node shared/taxonomy/validate-taxonomy.mjs
```

Expected success output:

```text
taxonomy validation ok
```
