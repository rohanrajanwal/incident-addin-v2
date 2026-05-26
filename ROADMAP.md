# Incident Reconstruction Engine — Roadmap

**Window:** 8 weeks (2026-05-26 → 2026-07-26)
**Target:** v2.0 GA at the end of week 8, ready to roll out to additional customer databases.

---

## Phase 1 — Foundation (Weeks 1–2) · 2026-05-26 → 2026-06-08

**Theme:** Make the existing flow actually work end-to-end on a real database, with photos and comments seamlessly attached to the exception event.

### Week 1 (2026-05-26 → 2026-06-01)
- [ ] **g560 end-to-end verification** — open a real exception, submit a report with photos, confirm everything lands on the exception event page in MyGeotab
- [ ] **Save-on-edit fix** — confirm the System Settings add-in JSON save now persists reliably (Ctrl+A + paste pattern was the workaround)
- [ ] **MediaFile + ExceptionEventAttachment regression test** — confirm `bf5dcbf` + `5beb31f` fixes hold on a non-demo DB
- [ ] **Comment on ExceptionEvent** — attach a short text comment to the event referencing the AddInData ID and submission timestamp, so reviewers can navigate from the exception to the full report

### Week 2 (2026-06-02 → 2026-06-08)
- [ ] **Receipt page polish** — show MediaFile IDs, AddInData ID, ExceptionEvent link in plain language, not raw JSON
- [ ] **Offline queue hardening** — if any of MediaFile / ExceptionEventAttachment / AddInData fail, retry on reconnect rather than dropping the submission
- [ ] **Better error surfacing** — distinguish "server rejected" vs "no network" vs "permissions" in the review/receipt screen
- [ ] **Install on 1–2 additional pilot databases** beyond g560 to confirm portability

**Exit criteria for Phase 1:** A driver can complete a report on a phone in Drive on g560, submit, and a fleet manager can open the exception event in MyGeotab and see all photos attached with a comment pointing to the AddInData report.

---

## Phase 2 — PDF Report (Weeks 3–4) · 2026-06-09 → 2026-06-22

**Theme:** Generate a single PDF combining telematics + driver evidence, matching the format of Geotab's official Collision Reconstruction PDF.

### Week 3 (2026-06-09 → 2026-06-15)
- [ ] **Pick a client-side PDF library** — likely `pdf-lib` (smaller, no rendering deps) over `jsPDF`. No backend required.
- [ ] **Cover page + Device Data section** — driver/vehicle/event metadata, mirroring the official PDF template
- [ ] **Analysis section** — natural-language description of the event built from `ExceptionEvent` + `LogRecord` data ("On {date} at {time}, the telematics device {serial} installed in a {year} {make} {model} with VIN {vin} recorded…")
- [ ] **Driver evidence section** — photos grouped by party and angle, damage zones, severity, narrative, occupancy, injuries, witness info

### Week 4 (2026-06-16 → 2026-06-22)
- [ ] **Speed & acceleration plots** — render longitudinal, lateral, and speed-over-time charts client-side (lightweight: hand-rolled SVG or tiny chart lib), then embed as images in the PDF
- [ ] **Map views** — embed static map images for the event location (street view, satellite, trip path). Use Geotab's existing map exports if accessible; otherwise an embeddable static-map URL.
- [ ] **Assumptions & disclaimers section** — verbatim from the official template
- [ ] **Download button** — appears on the review screen (pre-submit preview) and on the success screen (post-submit download). Also available from MyGeotab via a "Generate PDF" link in the AddInData record.

**Exit criteria for Phase 2:** Driver or fleet manager can click "Generate Report PDF" from the success page or from the AddInData record in MyGeotab and download an insurance-grade PDF that looks like the official Geotab Collision Reconstruction document plus a new driver-evidence section.

---

## Phase 3 — AI Backend & Smart Photo UX (Weeks 5–6) · 2026-06-23 → 2026-07-06

**Theme:** Wire up the AI backend, kill the fixed-photo-slot UX, let the driver dump all photos at once and let AI organize.

### Week 5 (2026-06-23 → 2026-06-29)
- [ ] **GenAI Gateway integration** — single endpoint call from the add-in, sends photos + context, receives structured JSON back. Uses Geotab GenAI Gateway (already on CSP allowlist) so no new vendor relationship.
- [ ] **Photo angle classification** — AI returns Front / Rear / Left / Right / Damage Close-up / Scene / Document for each photo
- [ ] **Damage zone + severity** — AI returns zones touched and Minor/Functional/Disabling per party
- [ ] **OCR** — driver's license, insurance card, vehicle tag/plate, registration. Returns name, policy #, VIN, plate, license #, address with per-field confidence.

### Week 6 (2026-06-30 → 2026-07-06)
- [ ] **Photo UX redesign** — replace 5 fixed slots with one "Add photos" area per party. Driver taps once, gets camera or library, can add as many as they want.
- [ ] **AI-organized grid** — after upload, photos auto-group under "Front", "Rear", "Left", "Right", "Close-up", "Scene" headings. Each photo has a "Reclassify" affordance.
- [ ] **Minimum-coverage check** — before letting Continue, verify at least one photo per damaged side (based on damage zones already selected)
- [ ] **Weather + Road Conditions auto-fill** — AI infers from scene photo, fills the Contextual Information page. Driver can override.

**Exit criteria for Phase 3:** Driver drops 8 random photos for "Your Vehicle" → AI sorts them into Front/Rear/Sides/Close-up/Scene, fills damage zones and severity, OCRs the third-party insurance card, and infers the weather. Driver only confirms or corrects.

---

## Phase 4 — In-App Video & GA Hardening (Weeks 7–8) · 2026-07-07 → 2026-07-26

**Theme:** Restore in-app video capture once Geotab Drive ships the mic permission, polish everything, prepare for broader rollout.

### Week 7 (2026-07-07 → 2026-07-13)
- [ ] **In-app video recording** — re-enable `<input type="file" accept="video/*" capture="environment">` and the custom video menu, gated on a Drive version check. Falls back to library-pick on older Drive builds. This depends on Geotab shipping `NSMicrophoneUsageDescription` (and ideally `NSCameraUsageDescription`) in their iOS Info.plist.
- [ ] **Video upload + ExceptionEventAttachment** — same multipart pattern as photos, attached to the same exception event
- [ ] **360° scene video AI** — extract frames, run weather/road/scene analysis on the strongest frame, supplement the still-photo inference

### Week 8 (2026-07-14 → 2026-07-20)
- [ ] **Cross-database install testing** — install and submit on at least 5 customer databases of different sizes/configurations
- [ ] **Accessibility pass** — tap target sizes, color contrast, screen reader labels
- [ ] **Telemetry** — add basic event logging (report started / step reached / submitted / failed) into an AddInData log record so adoption metrics are measurable from week 1
- [ ] **Documentation** — install guide for resellers/admins, troubleshooting runbook for fleet managers
- [ ] **Sign the add-in** — submit through Geotab's signing process so customers with strict policies can install it

### Week 8.5 (2026-07-21 → 2026-07-26)
- [ ] **GA cut** — tag v2.0, freeze main, hand off to first wave of customers
- [ ] **Postmortem prep** — gather metrics from pilot databases, identify v2.1 candidates

**Exit criteria for Phase 4:** Add-in is signed, installed on 5+ databases, driver can record video in-app on iOS, telemetry shows adoption, fleet managers have a runbook, ready for general rollout.

---

## Cross-cutting / parallel tracks

These run alongside the phases above without blocking them:

- **Geotab Drive iOS bug ticket** (mic + camera permissions) — file in Week 1, follow up biweekly, drives Phase 4 Week 7 timing
- **GenAI Gateway capacity / SLA** — confirm with the Gateway team in Week 4 that the expected per-submission token budget is reasonable
- **Customer feedback loop** — once Phase 1 ships on g560, gather feedback from the first fleet manager who uses it; feeds Phase 2/3 priorities
- **Signing & compliance** — start the signing conversation with Geotab in Week 5, well ahead of the Week 8 GA dependency

## Out of this 8-week window (v2.1 candidates)
- Multi-language support (currently English only)
- Driver-side notification when a fleet manager comments on the report
- Bulk export of all incident reports for a date range (for fleet-wide analysis)
- Integration with Geotab Video / dashcam clips, if the device has one
- Predictive prompts ("you usually photograph the rear-left corner — want to add one?")
- Voice narrative once Geotab Drive ships mic permission and we've validated text input is the bottleneck
