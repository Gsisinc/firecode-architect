"""Phase definitions for generate_field_workflow_docx.py (CEVA ACS field playbook)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PhaseSpec:
    num: str
    title: str
    week_window: str
    intro: str
    objectives: tuple[str, ...]
    procedures: tuple[str, ...]
    checklist: tuple[tuple[str, str, str], ...]
    hold_gate_after: str | None = None


PHASE_SPECS: tuple[PhaseSpec, ...] = (
    PhaseSpec(
        num="3",
        title="Day-zero — arrival, safety, footprint, iCare live",
        week_window="Week 1 (from Notice to Proceed)",
        intro=(
            "Lock in safe work zones, credible photos of the legacy system, and a shared mental model of MDF/ACP, docks, offices, "
            "and probable long pulls before demo accelerates."
        ),
        objectives=(
            "No door is left mechanically or electronically orphaned without Facilities + Security acknowledging the plan.",
            "Headend baseline is photographed and breaker sources are traced before removals begin.",
            "iCare reflects who is on site and establishes the photo cadence Procurement expects.",
        ),
        procedures=(
            "Identify yourself at Security; carry WO and badges. Obtain escort and radio/hand-off protocol if mandated.",
            "Complete customer safety orientation logbooks as required — note forklift/PIT crossings, eyewash, muster point, AED.",
            "Walk MDF/ACP/IDF candidates: slab, ceiling height, conduit path, pallet jack limits, slab door width for lifts.",
            "Capture wide + macro photos of legacy panels/enclosures/nameplates/rack elevations; record breaker numbers feeding ACS.",
            "Confirm who extends 120 VAC into LSP enclosures (facility vs contractor) — document name + date in WO note.",
            "Record site-specific hazards for lift operations (expansion joints, ramps, sprinkler deflectors overhead).",
            "Open iCare work order: arrival status, crew roster, ETA for next milestones, first photo uploads.",
            "Stage scrap vs recycle vs salvage vs hazmat pallets with labels consistent with disposal tickets.",
            "Lead reviews phase map with technicians: overlap allowed only where PM authored schedule states so.",
            "Identify doors that MUST remain badge-compensated tonight — document list with initials from Security liaison.",
        ),
        checklist=(
            ("Security acknowledgement + escort badges recorded", "Sign-in binder or WO comment", "Photo / scanned sheet"),
            ("Headend wide + macro photographic series complete", "Every legacy panel readable", "File naming convention"),
            ("Door security plan drafted for disturbed openings", "Security + Facilities initials", "Email excerpt"),
            ("Lift mobilization corridor cleared conceptually", "Supervisor thumbs-up snapshot", "Text thread screenshot"),
            ("iCare first update posted", "Timestamp visible", "Screen capture optional"),
            ("Hazard jot list attached to toolbox talk", "Verbal acknowledgement circle", "Notepad PDF"),
            ("Customer hot-work/permit stance understood", "Verbal Facilities rule", "Site rules email"),
        ),
        hold_gate_after="Do NOT begin Pro-Watch de-power until Legacy door-loss plan is jointly approved (Security/Facilities/Lead).",
    ),
    PhaseSpec(
        num="4",
        title="Pro-Watch decommission — orderly teardown",
        week_window="Weeks 1–3 (overlap pathway when safe)",
        intro=(
            "Remove legacy cleanly: inventory fidelity, tagging, disciplined cable disposition, disciplined battery hygiene, finishes patch within allowance."
        ),
        objectives=(
            "Every serialized asset disposition is evidenced (scrap, transfer, salvage) per WO instructions.",
            "DC power dismantling follows insulating-tool discipline and SDS awareness for batteries.",
            "No egress / fire door is degraded overnight without guarded mitigation documented.",
        ),
        procedures=(
            "Create or extend decommission workbook: hostname, MAC, rack U, breaker, serial, proposed disposition column.",
            "Execute disable sequence per customer-approved cutover worksheet (typically field peripherals down before CPUs).",
            "Remove readers/REXs/modules with minimized finish damage — photograph holes prior to patching.",
            "Tag each cable truncated: origin panel designation, inferred route, disposition code (CUT / ABND / RET).",
            "Strip rack-mounted controllers/PSU; bag hardware; segregate fasteners; reclaim usable jumpers sparingly.",
            "Remove batteries sequentially with lifting aids; electrolyte precaution PPE maintained; pallets lined for recycler.",
            "Patch paint within allowance limits; escalate drywall/struct surprises to PM for CO wording.",
            "PM bundles inventory spreadsheets + disposal manifests + annotated photos attachable to WO same business day closure step.",
            "Spot audit: random 10% cables confirm labels match workbook before proclaiming Phase 4 substantially complete.",
        ),
        checklist=(
            ("Workbook completeness ≥95% tracked devices", "PM eyeball QA", "Spreadsheet archived"),
            ("Battery manifests signed where hazmat mandated", "Disposal vendor receipt scanned", "PDF in SharePoint/job folder"),
            ("Security overnight door walk acknowledgment", "Text or WO comment", "Timestamp"),
            ("Rack photos post-strip", "Empty bay proof", "Upload"),
            ("Fire/smoke caulking disturbances restored if in scope", "Facilities initials", "Email"),
            ("Lead initials on demo closure memo", "No mystery powered stubs", "PDF memo"),
            ("Scrap segregation photo", "Recycle vs landfill evidence", "Camera roll"),
            ("Toolbox talk hazards closed", "No open ceiling tiles unsecured", "Photo sweep"),
        ),
    ),
    PhaseSpec(
        num="5",
        title="Pathway & rough-in — supports, stubs, labeling discipline",
        week_window="Weeks 2–5",
        intro=(
            "Slow is smooth: rafter supports, conduit stub elevations, geometric cable paths, tagging discipline — SAT success is seeded here."
        ),
        objectives=(
            "Every homerun geometrically sane ≤500 ft to panel/home or flagged for engineered IDF solution before concealment.",
            "Service loops staged per spec at field ends with dual-end labels created during pull—not afterthought.",
            "Lift plans respect floor load + swing radius documented by rental vendor guidance.",
        ),
        procedures=(
            "Plot each reader group spine on drawing or annotated PDF noting measured wheel distances to MDF/ACP/IDF hypotheses.",
            "Install J-hooks or approved supports per warehouse door policy; tighten to structural steel per anchor spec—no improvised zip-tie-only spans where prohibited.",
            "Install conduit stubs at ~15 ft AFF where mandated; bushings deburred prior to pulls.",
            "Maintain manufacturer bend radii bundles; segregation from EMI sources where reasonably practical documenting exceptions.",
            "Pre-label pull strings referencing planned cable numbering scheme — sync scheme with Programmer before Phase 10.",
            "Fire-seal provisional penetrations nightly if Facilities demands during active demo overlap.",
            "Photograph unusually congested truss zones for latent engineering liability notes.",
            "Daily Lead summary: cumulative feet installed vs schedule + flagged long pulls list.",
            "Coordinate tandem crew alignment if second building runs parallel — avoid duplicative lift delivery conflicts.",
            "Stage empty cable reels return or recycle bins to keep dock courtesy high.",
        ),
        checklist=(
            (">500 ft candidate list circulated to PM with photos", "Wheel measure photos", "Email thread"),
            ("Service loop coils dressed + temp tie", "QC walk", "Photo each zone sample"),
            ("Lift inspection sticker valid + operator checklist", "Tag photo", "Rental binder"),
            ("Anchor torque spot-check notebook entry", "Wrench preset log", "Notepad scan"),
            ("Label numbering scheme emailed to Programmer", "Inbox acknowledgement", "Email"),
            ("Housekeeping bays walkable", "Supervisor selfie corridor", "Photo"),
            ("Penetrations sealed nightly if mandated", "Facilities thumbs-up SMS", "Screenshot"),
            ("Dual-building coordination note logged", "PM reply", "WO comment"),
        ),
    ),
    PhaseSpec(
        num="6",
        title="Cable pulls, typology segregation, QA before conceal",
        week_window="Weeks 3–6",
        intro=(
            "Composite yellow plenum for standard readers; shielded yellow 22/6 for IN/OUT where mandated; segregate labeling from auxiliary green Cat6."
        ),
        objectives=(
            "Pull list closed with continuity map tests prior to drywall/ceiling final passes.",
            "No concealed ceiling lacking Lead spot QA on labeling + slack + firestop intent.",
            "Spare pairs strategy documented where intercom trigger pairs ride composite bundles.",
        ),
        procedures=(
            "Stage reels near pull midpoints minimizing floor crossing traffic with PIT coordinators where active.",
            "Partner-pull long trays; allowable lubricants only per mfr additive policy — never random soap.",
            "Immediate dual-end tagging before cable memory tangles labeling truth.",
            "Continuity/map test pairs per company policy; annotate failures with red flare zip + photo + spreadsheet row.",
            "Segregate IN/OUT 22/6 runs physically in bundles at headend trough to reduce mis-termination risk later.",
            "Green Cat6 for intercom/AP drops if in scope pulled with distinct color-coded labels—not reader numbering sequence.",
            "Record actual installed footages per reel partial for PM burn-down tracking vs BOM.",
            "If field condition invalidates modeled IDF hypothesis mid-pull escalate before burning another 500+ ft mistakenly.",
            "Archive test printouts/screenshots nightly to job portal folder dated subfolders.",
            "Facilities reinspection after major ceiling tile disturbance blocks before declaring rough-in QA closed.",
            "Maintain fire-stop go-bags (caulk/spec pads) reachable for punch immediate correction.",
            "Conduct random 10% tug-test on lash points in warehouse bays after install day heat cycling.",
        ),
        checklist=(
            ("Pull test logs stored", "Screenshots zipped", "Cloud path URL in WO"),
            ("Red-flag failed pairs visibly tagged unresolved count =0 OR documented RFI", "Spreadsheet truth", "PM sign tiny note"),
            ("Composite vs 22/6 vs Cat6 segregation photo at trough", "Color rows obvious", "Camera"),
            ("Slack coils uniform direction", "Sample measurement 10 ft", "Tape photo"),
            ("Ceiling tile QA spot Lead initials", "Chalk/date on deck", "Photo"),
            ("Reel remnants weighed or inventoried disposal", "Scale ticket snap", "File"),
            ("Inter-spare conductors noted on chart", "Engineer confirmation email", "Inbox reply"),
            ("Customer dust control expectations met", "Facilities thumbs-up optional", "Text"),
            ("Evening housekeeping photo dock", "No trip hazards", "Photo"),
            ("RFI backlog count recorded", "PM morning standup note", "WO comment"),
        ),
        hold_gate_after="ZERO permanent ceiling/soffit concealment covering new homeruns until Lead QA row on checklist is cleared.",
    ),
    PhaseSpec(
        num="7",
        title="Headend — LSP, LP1502, MR52, structured grounding",
        week_window="Weeks 4–7",
        intro=(
            "Mechanical grounding, torque discipline, and fanatical labeling correlate directly with clean Mercury diagnostics later."
        ),
        objectives=(
            "DC distributions stable unloaded then loaded sequentially without nuisance trips.",
            "Every landing maps 1:1 to panel schedule naming PM will bake into ACM import.",
            "Yellow Cat6 patch paths light switch link/partner lights before LAN integration rehearsal.",
        ),
        procedures=(
            "Rack elevations confirmed against drawing including future expansion U reservation if stipulated.",
            "Bond LSP/enclosure/stack per manufacturer stacking kit + supplemental ground bus if spec demands.",
            "Extend customer 120VAC feed internally per single-line—torque lug, strain relief anti-short bushings insulated.",
            "Dress MR52 commons before energized I/O attaches; polarity confirm with meter before sensitive modules snap-in.",
            "Install batteries freshest date forward; insulating wrenches enforced; polarity stickers immediate.",
            "Print interim panel schedule tape-laminated at enclosure door until engraved tags arrive if policy.",
            "Preliminary link-test yellow Cat6 to switch documenting switch port allocations PM shares with NetOps.",
            "Thermal snapshot infrared optional hot-spot preventive if company owns camera.",
            "Capture cabinet closed-door ventilation gap compliance photo for LEED sites if seldom asked unexpectedly.",
            "Lock cabinet keys register handoff Facilities if customer owns key control.",
            "Generate preliminary BOQ variance report if BOM substitutions occurred—PM pricing feedback loop.",
            "Stage programming laptop anti-static bench nearby before Phase 10 cut.",
        ),
        checklist=(
            ("Ground bond meter ≤ spec ohms captured", "Fluke screenshot", "PDF"),
            ("Torque checklist signed", "Annotated paper photo", "File"),
            ("Battery install date Sharpie evident", "Close-up pics", "Camera roll subset"),
            ("Panel schedule revision saved vX.Y", "Filename includes date", "Share link"),
            ("Switch uplink patched + link light photographed", "EXIF/time match", "Image"),
            ("Cabinet key register entry", "Logbook photo / chain-of-custody note", "File"),
            ("Substitution RFI closures count = required", "PM confirmation", "Email"),
            ("Ventilation conformity snap", "Ruler clearance photo", "Image"),
            ("Housekeeping compressed air blow-down optional dust", "Particles pic before/after", "Optional shot"),
            ("Locked door policy understood", "Security note", "WO comment minimal"),
            ("Spare fuse kit staged inside door pouch", "Visual open door", "Photo"),
            ("Infrared hotspots none critical", "IR camera save", "If applicable"),
        ),
    ),
    PhaseSpec(
        num="8",
        title="Door & perimeter devices — electrified hardware choreography",
        week_window="Weeks 4–8 overlapping headend",
        intro=(
            "Each opening choreography: credential read, hinge logic, REX fairness, IDS DPDT, IN/OUT annunciation fidelity, finish plates square."
        ),
        objectives=(
            "Reader mounting heights obey architectural accessibility + corporate standard deviations documented.",
            "Mag strategy absent unless engineered exception exists on signed PDF.",
            "IT suite keypads keyed per hardware matrix without lazy reader substitution undocumented.",
        ),
        procedures=(
            "Dry-fit reader/backbox square plumb shim trace template before penetrating expensive veneer doors.",
            "Terminate reader cable per datasheet pin orientation color photographs stapled traveler packet.",
            "Coordinate locksmith timing for cylindrical/mortise deviations—never improvise pinning.",
            "Install strike/EL per sequence: power limited class evaluation, diode orientation if EMI sensitive, preload voltage measure.",
            "Wire DPDT door contacts cleanly—twist shields trim length consistent—IDS partner present if witness required.",
            "Install IN/OUT annunciators per secure-side localization rules pre-walk with Security verifying audibility—not guessed.",
            "Weatherized contacts only on exposures per BOM divergence flagged if architect revision conflicts.",
            "Commission temporary construction defeat jumpers NONE once door live—remove all yellow wire nuts nightly inventory.",
            "Capture door-before & door-after photos for punch aesthetic narrative.",
            "Record torque on crash bar fasteners if micrometer checklist exists on high-liability egress.",
            "Sync naming stickers on glass interim labels with Programmer canonical naming scheme spreadsheet.",
            "Bag spare finish screws tethered interior frame pocket for Facilities friendly turnover.",
            "Summarize deviations from engineered sequence on singular red markdown page updated daily.",
            "Maintain lockout tagging if bridging strike power during intrusive hardware alignment windows.",
            "Conduct mini functional pretest at door before leaving (LED feedback only) avoiding full DB writes—document raw input states screenshot from diagnostic utility if permissible.",
            "Maintain static mats at reader bench pop-ups indoors—humidity disclaimers acknowledged.",
            "Evening unsecured door tally must read zero unresolved before leaving site nightly.",
            "Maintain battery-powered emergency lighting awareness when kill power localized testing.",
            "Conduct foreign voltage sneaker test strike pairs before insulating dress.",
            "Archive optional SPL meter readings for IN/OUT strobe audibility where acoustically sensitive.",
        ),
        checklist=(
            ("Reader height conforms to elevations ± tolerance", "Laser measure snapshot", "Photo"),
            ("Mag-lock exception PDF on file OR none installed", "PM verification", "Email"),
            ("IT doors use keypad model per matrix", "Visual ID label + SER match", "Photo"),
            ("Strike voltage within class spec unloaded/loaded", "Meter log", "Spreadsheet row"),
            ("DPDT wiring witness optional sign-off", "IDS tech initials", "Scan"),
            ("IN/OUT sounder audibility walk", "Security listener sign-off", "WO note"),
            ("Nightly unsecured door tally = 0", "Lead chat export", "Screenshot"),
            ("Deviation redlines updated", "Filename includes date", "PDF link"),
        ),
    ),
    PhaseSpec(
        num="9",
        title="Power-on discipline & ladder functional proofs",
        week_window="Weeks 5–8",
        intro=(
            "Gradual energization, measurement-first habits, per-door LED sanity before database complexity masks hardware faults."
        ),
        objectives=(
            "No bulk enable that trips main DC without staged fold-back plan documented.",
            "Reader physical layer proven before Programmer loads heavy conditional logic marathon.",
            "Punch list born early—not week-of-SAT scramble.",
        ),
        procedures=(
            "Stage fold-back procedural card inside enclosure exterior pocket listing breaker order numbering.",
            "Energize LSP unloaded rails first—record resting voltages; compare to datasheet nominal bands.",
            "Apply loads panel-by-panel quadrant strategy logging inrush amps if meter capable.",
            "Boot Mercury; capture firmware/boot screen photo time sync evidence if customer audits drift.",
            "Per reader: factory reset if policy then minimal address confirm—LED patterns recorded short video clip optional.",
            "Per door strike: audible click test mechanical binding listen—temperature note if coils heat fast abnormal.",
            "REX walk-test timing verified; investigate nuisance thermal issues on exterior PIRs if suspected.",
            "Document first-pass punch lines in shared tracker link anchored in WO body daily hyperlinks nightly.",
            "Facility coordination for audible strike/function tests outside core business hours if required.",
            "Optional brief battery discharge check if runtime margins are tight — confirm with PM.",
            "Ground fault troubleshooting: isolate branch; do not repeatedly reclose blind without diagnosis.",
        ),
        checklist=(
            ("Fold-back card posted", "Photo inside door", "Image"),
            ("Unloaded rail voltages table", "Spreadsheet row", "File"),
            ("Panel boot success timestamp", "Screen photo", "Image"),
            ("Reader enumeration ≥ planned count", "Checklist tally", "Sheet"),
            ("Strike audition log complete sample", "Checklist tally", "Sheet"),
            ("Punch tracker URL in WO nightly", "Hyperlink clickable", "WO"),
            ("Noise courtesy notifications sent", "Email proof", "Inbox snap"),
            ("GF trip investigation closed or documented RFI", "Engineer note", "File"),
            ("Battery sample load sanity OR waived documented", "PM email", "File"),
            ("Evening recount unsecured openings", "Lead sign", "SMS"),
        ),
    ),
    PhaseSpec(
        num="10",
        title="ACM programming synchronization & LAN marriage",
        week_window="Weeks 6–9",
        intro=(
            "Database fidelity to labeling + IP fidelity to sheet + minimized mystery multicast storms = smooth turnover."
        ),
        objectives=(
            "Hardware topology in ACM matches field labels without orphan nodes.",
            "Credential technology bits align order—no brute forcing wrong format wastes weekend.",
            "Exports exist PM can freeze as acceptance baseline snapshots.",
        ),
        procedures=(
            "Import naming CSV if Lead maintained— Programmer reconciles deltas live screen share optional.",
            "Assign IPs EXACT subnet host plan—no dhcp unless written exception tracked.",
            "Document MAC table mapping per panel row for Networking audit binder.",
            "Configure reader formats per HID spec—capture screen export settings printout PDF.",
            "Define door strike times relock delays anti-passback only if spec demands—default conservative until Security workshop.",
            "IN/OUT logic simulation with tech card walk scripts before customer cards mass enrolled.",
            "VPN path test with CEVA operator remote window scheduled PM calendar visible.",
            "Backup snapshot labelled SITE_PHASE10_BASELINE.revA.bin per vendor export guidance.",
            "Latency ping chronicling if flaky switch hypothesized correlate link errors windows.",
            "Access level creation ownership clarified per contract—if client-owned document handoff readiness checklist separate PDF.",
            "Export door summary / schedule for customer O&M binder per PM format.",
            "Malware-scan laptop segregation air-gap policy obey customer infosec if scanning rig required.",
            "Rollback script documented if programming corruption hypothetical disaster recovery rehearsal optional tabletop.",
            "Conduct reader encryption key rotation ONLY if mandated—don't hobby rotate.",
            "Confirm time sync authoritative NTP reachable from VLAN policy else manual doc drift risk.",
            "Validate anti-tamper switch settings door forced events produce correct priority color codes mock test.",
            "Programmer initials logbook entry hours burn vs estimate communication PM nightly delta.",
        ),
        checklist=(
            ("IP/MAC reconciliation sheet uploaded", "NetOps written acknowledgement", "Email"),
            ("Reader tech format screenshots archived", "Folder path", "URL"),
            ("Baseline backup artifact stored immutable", "Hash optional", "File"),
            ("IN/OUT sim walk complete", "Security witness optional checklist", "Form"),
            ("VPN handshake success screenshot", "Redacted IPs if policy", "Image"),
            ("Access-level ownership matrix signed", "PM and customer signatories", "Scan"),
            ("Time sync evidence log", "CLI capture", "TXT"),
            ("Tamper forced door color test pass", "ACM UI capture", "PNG"),
            ("Programmer hours variance tracked vs estimate", "PM acknowledgement", "Email"),
        ),
    ),
    PhaseSpec(
        num="11",
        title="SAT, witness testing, punch burn-down",
        week_window="Weeks 7–10",
        intro=(
            "Formal proof with customer eyes: matrix tests, IN/OUT edge cases, labeling glass plan harmony, iCare language precision."
        ),
        objectives=(
            "Zero critical punch open at declared SAT-complete instant unless waiver risk accepted in writing.",
            "Customer nomenclature on glass matches ACM record literally including ampersands oddities.",
            "Program team notification accuracy per iCare playbook.",
        ),
        procedures=(
            "Print door test matrix customizing columns per contract—badge allow/deny RTE forced door auxiliary.",
            "Use representative production credentials for SAT — not engineer-only test fobs.",
            "Schedule SAT to minimize operational disruption; document if peak-hour testing is unavoidable.",
            "Photo each PASS/FAIL sticker door edge temporary during remediation cycle remove after PASS only.",
            "Collect authorized signatures electronically or on paper per customer preference.",
            "Confirm IN/OUT strobe audible levels with Security / operations if required.",
            "Failed item immediate root categorize software vs hardware assignment avoid ping-pong thrash.",
            "Retest only after discrete fix—not bundled mystery five fixes ambiguous.",
            "Conduct SAT summary review with PM and customer; agree on language for acceptance and any punch deferrals.",
            "Retain SAT supporting photos per customer retention policy.",
            "Conduct warranty / CMMS start-date handoff per Facilities process.",
            "Export event log snippet showing clean day window sample health narrative.",
            "SAT signatory page scan legible not thumb covering text.",
        ),
        checklist=(
            ("Matrix rows all resolved PASS or deferred with owner", "Spreadsheet filter", "File"),
            ("Glass names match ACM string-exact diff tool", "Script or eyeball", "PDF diff"),
            ("iCare SAT wording PM approved", "Screenshot", "Image"),
            ("Critical punch count = 0 OR waivers signed", "Risk form", "PDF"),
            ("Customer signature scans stored", "Readable PDF", "File"),
            ("Deferred cosmetic list acknowledged", "Email chain", "Link"),
            ("Warranty start email sent", "Timestamp", "Mail"),
            ("Event log health excerpt attached", "Export", "ZIP"),
        ),
    ),
    PhaseSpec(
        num="12",
        title="Documentation, redlines, turnover binder, training bridge",
        week_window="Weeks 8–11+ (through contract completion milestone)",
        intro=(
            "Poor documentation delays final acceptance and payment — align turnover with CEVA program expectations "
            "(target milestone June 25, 2026 per published RFP — confirm the operative completion date on your PO)."
        ),
        objectives=(
            "As-built set matches field—including homerun numbering, elevations, pathway divergences.",
            "Corporate Security wiring/programming deviation log empty or approvals attached.",
            "Training bridge scheduled: customer administrators know how to request routine access changes per agreed process.",
        ),
        procedures=(
            "Compile finalized as-built drawing set with revision marking (FIELD-AS-BUILT naming per PM).",
            "Panel schedules in spreadsheet tabs per enclosure — cross-check row count vs terminations.",
            "Update logical network diagram: switch names, panel names, VLAN notes per NetOps template.",
            "Curate concise photo set for turnover (prioritize headend before/after, representative doors).",
            "Credential / change-management handoff summary: SLAs for adds/moves/removes.",
            "Store exported programming backups per PM retention policy.",
            "Internal lessons-learned note for QIS (optional improvement items).",
            "Complete OEM warranty registrations with serial captures if in scope.",
            "Close rental / tool returns; photograph equipment condition.",
            "Reconcile surplus material for shop restock.",
            "Send concise project close acknowledgement to customer per PM template.",
            "Optional 30-day follow-up cadence scheduled with customer agreement.",
            "Archive complete job folder to standard template.",
            "Post final iCare / WO closure language aligned with PM and Procurement.",
            "If intercom/ACC recording paths exist, confirm data retention expectations with customer Legal/Compliance.",
        ),
        checklist=(
            ("As-built PDF set uploaded + versioned", "Share link", "URL"),
            ("Panel schedule XLSX complete", "Row count matches terminations", "Sheet"),
            ("Network diagram approved", "NetOps email", "File"),
            ("Training bridge session cal invite sent", "ICS file", "Mail"),
            ("Backup artifacts double-stored", "Two paths listed", "WO"),
            ("Warranty submissions confirmed", "Portal screenshot", "PNG"),
            ("Rental close-out pics", "No damage", "JPEG"),
            ("iCare closure language customer accepted", "Screenshot", "Image"),
            ("Legal retention note regarding video/intercom if any", "Compliance email", "Msg"),
        ),
    ),
)
