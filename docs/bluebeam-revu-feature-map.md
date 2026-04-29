# Bluebeam Revu feature map

This document captures the Bluebeam Revu feature areas researched for the product roadmap and maps them to the fire alarm design assistant.

## Bluebeam Revu functionality areas

1. PDF viewing and navigation across construction drawing sets.
2. Markup tools: text, typewriter text, callouts, clouds, lines, arrows, shapes, polygons, images, stamps, and symbols.
3. Measurement and takeoff tools: length, polyline length, area, perimeter, angle, diameter, volume, counts, cutouts, and calibrated drawing scale.
4. Tool Chest: reusable custom markups/symbols organized into tool sets, with saved properties or exact-drawing modes.
5. Markups List: searchable/filterable list of all markups with columns, statuses, comments, quantities, summaries, and exports.
6. Layers: assign markups to drawing layers and toggle layer visibility.
7. Spaces: define named areas so markups and quantities can be grouped by room/zone.
8. Sets: manage multi-sheet drawing packages as a coherent set with revisions.
9. Batch processing: compare documents, overlay pages, batch OCR, batch links, page setup/crop, headers/footers, stamps, slip sheets, split documents, and sign/seal.
10. Document comparison and overlay to detect revisions.
11. OCR and text search for scanned drawings.
12. Hyperlinks/bookmarks/table-of-contents tools for sheet navigation.
13. Studio Sessions/Projects: real-time collaboration, permissions, markup history, comments, and reports.
14. PDF page operations: combine, split, extract, rotate, delete, insert, reduce file size, and security permissions.
15. Forms, signatures, stamps, and flattening workflows.
16. Export/report workflows for takeoffs, markups, PDF packages, and project records.

## Product implementation direction

The current app already has the beginning of a domain-specific drawing workspace: floor plans, devices, rooms, layers, device palette, calculations, circuit routing, BOM, and exports. The closest Bluebeam-aligned growth path is:

1. **Plan viewer foundation**: calibrated scale per floor, pan/zoom/navigation, image/PDF sheet support, sheet thumbnails.
2. **Markup engine**: generic markup objects separate from fire-alarm devices, including lines, arrows, clouds, text, callouts, polygons, and stamps.
3. **Measurement takeoff**: calibrated length/area/count tools with unit-aware quantities.
4. **Tool chest**: reusable device/markup palettes, project templates, and saved symbol properties.
5. **Markups list**: searchable table of devices, wires, rooms, notes, measurements, status, comments, quantities, and exports.
6. **Document set management**: multi-floor/multi-sheet drawing sets, revisions, overlays, and change comparison.
7. **Collaboration**: comment threads, audit trail, permissions, session-style shared reviews.
8. **Batch/export workflows**: batch PDF generation, stamped submittals, reports, DXF/SVG/PNG/PDF exports.

This repository should build those capabilities incrementally around the fire-alarm workflow rather than attempting a generic Bluebeam clone in one pass.
