# Browser Baseline

**Baseline date:** 30 July 2026  
**Product:** Fieldwork Plan Generator  
**Version:** 1.0.0

## Intent

Provide a browser interface that allows engineering staff to upload project figures, edit a plan register, and download an A1 landscape PowerPoint fieldwork plan without operating a desktop GUI.

## Operational baseline

The application is operational when:

- the home page loads in a modern browser;
- multiple image uploads generate a valid PowerPoint;
- invalid register data returns a useful browser error;
- temporary uploads are removed after the response;
- `/health` returns HTTP 200;
- automated builder and API tests pass; and
- the production Docker image builds.

## Next product decisions

- whether projects should be saved server-side;
- whether authenticated user accounts are required;
- whether PDF export is required;
- whether fieldwork-specific forms, borehole schedules, site contacts, safety controls and inspection checklists should become structured modules; and
- which hosting environment will be used for the permanent production URL.
