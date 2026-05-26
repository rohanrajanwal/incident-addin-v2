# Incident Reconstruction Engine — Product Requirements Document

**Owner:** Rohandeep Rajanwal
**Status:** Active development (v2.0)
**Last updated:** 2026-05-26
**Target GA:** 2026-07-26 (8 weeks from now)

---

## 1. Background

When a Geotab-equipped vehicle is involved in a collision, the fleet currently has two disconnected pieces of evidence:

1. **Telematics data** — Geotab GO devices automatically capture speed, GPS, g-force, and accelerometer data around the event. This is rich but technical, and gets surfaced only when someone manually pulls the official Geotab Collision Reconstruction PDF (see `CollisionReconstruction - G9TTCKWCF5Y3 [INT].pdf` for the reference format).
2. **Driver-side context** — what the driver saw, who was involved, photos of damage, third-party insurance/registration, police citation, witness contact info. Today this lives in driver memory, paper forms, text messages to fleet managers, or photos on personal phones. It rarely makes it back to MyGeotab in a structured way.

The Incident Reconstruction Engine fills that gap. It runs as a Geotab Drive add-in on the driver's tablet/phone, walks the driver through a guided collision report at the scene, captures and uploads media to the MyGeotab exception event that the GO device already flagged, and produces a single comprehensive report that combines telematics data with driver-collected evidence.

## 2. Users

| Persona | Where they touch the product | What they need |
|---|---|---|
| **Driver** | Geotab Drive on tablet/phone, at the scene | Calm, guided, fast flow. Big tap targets. Works offline. Minimum typing. |
| **Fleet manager** | MyGeotab web, exception event page | Photos and report attached to the right event automatically. No hunting through email. |
| **Claims / legal / safety** | MyGeotab web → exported PDF | Single PDF combining telematics + driver report. Insurance-grade evidence. |
| **Reseller / customer admin** | Add-in install in System Settings | One-config install, works on existing databases, no backend infra to deploy. |

## 3. Goals & Non-Goals

### Goals (what success looks like)
- A driver can complete an incident report in **under 8 minutes** at the scene.
- Photos, documents, and the report appear **directly on the exception event page** in MyGeotab — no separate inbox.
- A fleet manager can **download a single PDF** that combines telematics and driver evidence, suitable for handing to an insurer.
- AI **reduces driver effort** — auto-classifies photo angles, auto-fills damage zones and severity, extracts insurance/license data via OCR.
- Works on **Geotab Drive on iOS and Android** with no app changes required from the Drive team beyond NSMicrophoneUsageDescription.

### Non-goals (explicit out-of-scope)
- Standalone web/mobile app outside of Geotab Drive.
- Real-time collaboration between driver and fleet manager during the report.
- Pre-incident dashcam streaming (separate Geotab Video product).
- Replacement for police reports, insurance claims, or DOT filings — this is a structured evidence collector, not a legal document.
- Audio narrative (blocked by missing `NSMicrophoneUsageDescription` in Geotab Drive iOS).

## 4. Current State (as of 2026-05-26)

**Repo:** https://github.com/rohanrajanwal/incident-addin-v2
**Live:** https://rohanrajanwal.github.io/incident-addin-v2/index.html
**Installed on:** g560 (alpha.geotab.com) — pending end-to-end verification

### Flow today
17 screens, all built and styled:
1. Current Incidents list (pulls open ExceptionEvents for the driver)
2. Safety check (breathe / call manager / call 911)
3. Communication guidelines (who to talk to, who not to)
4. Qualifying questions (third party? at scene? property damage?)
5. Photos — Your Vehicle (5 fixed slots: Front, Rear, Left, Right, Damage Close-up) + optional 360° scene video
6. Photos — Third Party Vehicle (same 5 fixed slots)
7. Damage Assessment — Your Vehicle (SVG diagram + zone chips)
8. Severity — Your Vehicle (Minor / Functional / Disabling)
9. Damage Assessment — Third Party
10. Severity — Third Party
11. Documents (Insurance/Registration with mock OCR, Driver's License, Insurance Card, Vehicle Tag) + optional third-party contact
12. Police Report (citation toggle, document upload, third-party-fault toggle)
13. Property Damage (if applicable — type, address, photo)
14. Contextual Information (date/time, location, speed, g-force, weather, road — auto-filled from telematics, weather/road still "—")
15. Voice Narrative (text only — voice blocked by missing iOS mic permission) + occupancy steppers + injuries + witness contact
16. Review (all sections collapsible, edit-in-place)
17. Success / receipt

### What works
- All UI screens build and render correctly on iOS and Android in Geotab Drive
- Native iOS camera (`api.mobile.camera.takePicture()`) for photos — bypasses iOS browser permissions
- Driver name pulled from `User` entity via session lookup
- Exception event details (date/time, location, speed, g-force) pulled from real `ExceptionEvent` + `LogRecord` data
- MediaFile upload (entity Add + multipart binary POST to `/apiv1/`)
- `ExceptionEventAttachment` created after each upload — photos appear on the exception event page in MyGeotab
- AddInData saves the full structured report payload
- Phone formatting, doc previews, X-button removal, octet-stream MIME handling on iOS

### What's broken / missing
- **End-to-end verification on g560**: code is deployed and the add-in is installed, but a full submit-and-verify on a real exception has not been completed.
- **Weather and Road Conditions**: hardcoded to `—`. External APIs (Open-Meteo) are blocked by Geotab's CSP. Will be filled by AI backend.
- **OCR**: mock data only — real backend not connected.
- **In-app video recording**: removed because `NSMicrophoneUsageDescription` is missing from Geotab Drive's iOS Info.plist (filed with Geotab Drive team). Workaround: driver records in Camera app, attaches from library.
- **No PDF report**: only AddInData JSON + photos. A combined PDF matching the official Geotab Collision Reconstruction format does not exist yet.
- **Fixed photo slots**: driver must tap the specific slot for "Front View", "Rear View", etc. Should accept any photos and auto-classify.

## 5. Scope — v2.0 GA Feature Set

### 5.1 Driver-facing flow (incremental from current)
- Open incident from list → walk through 14 content screens → review → submit
- All screens work offline; queued submissions sync when back online
- Photo capture uses native camera API on Geotab Drive mobile, file input fallback on desktop
- Documents capture supports image-only (camera or library) with OCR extraction
- Witness, third-party contact, and property damage fields all optional but collapsible-by-default

### 5.2 Photo capture — UX redesign (planned)
- Replace 5 fixed angle slots with a **single "Add photos" surface** per party (your vehicle / third party)
- Driver can capture or pick any number of photos in any order
- AI classifies each photo as Front / Rear / Left / Right / Close-up / Scene / Document on upload
- AI groups them visually under those headings, with a "Reclassify" tap for corrections
- Still enforce a minimum (e.g. at least one photo per damaged side) before allowing Continue

### 5.3 Upload to MyGeotab — what gets attached
Per submission, the add-in writes:
- One `MediaFile` per photo (random 16-char lowercase name, `.jpg`) with binary uploaded via multipart POST to `/apiv1/`
- One `ExceptionEventAttachment` per `MediaFile` linking it to the originating `ExceptionEvent` — this is what makes media show up on the exception page in MyGeotab
- One `AddInData` record holding the full structured report (driver/vehicle info, damage zones, severity, narrative, occupancy, witness contact, OCR'd third-party fields, all media file IDs)
- A comment on the `ExceptionEvent` (where supported) linking back to the AddInData record so reviewers can navigate from the exception to the full report

### 5.4 Generated PDF report
A driver- or manager-triggered PDF download from the review screen and from the MyGeotab exception page. The PDF combines:

**From telematics (matches official Geotab Collision Reconstruction format):**
- Cover page: device S/N, model, reseller, customer, date of analysis, date of record
- Device data summary
- Vehicle speed & acceleration plots (longitudinal, lateral, speed-over-time around the event window)
- GPS / address timeline (where the vehicle was leading up to and after the event)
- Map views (street + satellite + trip map) — embedded from MyGeotab's standard map exports
- Google Street View at the event location
- Reconstruction summary paragraph (auto-generated from the data)
- Standard assumptions and disclaimers section

**From driver-collected evidence (new section):**
- Submission timestamp + driver name + vehicle
- Qualifying questions (third party / at scene / property damage)
- Photos of your vehicle, grouped by angle (AI-classified)
- Photos of third party vehicle, grouped by angle
- Damage zones and severity for each party
- Narrative / description of incident
- Occupancy & injuries
- Third party driver info (OCR'd insurance, license, plate)
- Police report info (citation issued, fault assignment)
- Property damage info (if applicable)
- Witness contact info (if applicable)

PDF generated client-side using a library like `pdf-lib` or `jsPDF` (no backend, no external API). Telematics charts rendered as embedded PNG/SVG via lightweight Chart.js or hand-rolled SVG.

### 5.5 AI backend (planned)
Single endpoint accepting a list of photos + report context, returning:
- `photoClassification`: per-image angle, party (your/third), confidence
- `damageZones`: per party, list of zones detected
- `severity`: per party (Minor / Functional / Disabling)
- `vehicleTypeThirdParty`: car / truck / SUV / motorcycle / etc.
- `ocr`: from doc photos — name, policy #, VIN, plate, license #, address
- `weather`: from scene photo — clear / rain / snow / fog
- `roadConditions`: from scene photo — dry / wet / icy / debris

**Backend choice:** Geotab GenAI Gateway, calling Claude Sonnet via the existing `cli-genaigateway` integration. No new vendor relationship, no new auth, fits Geotab's compliance posture. Inference is per-submission (not streaming), expected <10s.

## 6. Technical Architecture

```
[ Geotab Drive mobile / MyGeotab web ]
        |
        v
[ Add-in iframe — GitHub Pages ]
   index.html / app.js / styles.css
        |
        |--- MyGeotab JS API (api.call, api.mobile.*) ---> [ MyGeotab database (g560, etc.) ]
        |        - ExceptionEvent (read)
        |        - User, Device (read)
        |        - LogRecord, GetAddresses (read for context)
        |        - MediaFile.Add + multipart POST to /apiv1/ (write)
        |        - ExceptionEventAttachment.Add (write)
        |        - AddInData.Add (write structured report)
        |
        |--- HTTPS POST -----------------------------> [ Geotab GenAI Gateway ]
                                                          - photo classification
                                                          - OCR
                                                          - weather/road inference
                                                          - severity suggestion
```

### Frontend stack
- Vanilla JS (no framework) — keeps bundle small for slow connections at the scene
- CSS variables for theming, mobile-first (max-width 480px)
- No build step — index.html links directly to app.js and styles.css with `?v=N` cache busting
- Hosted on GitHub Pages from `master` branch — auto-deploys on push

### Data persistence
- Local: `reportData` object kept in memory; offline queue in `localStorage` for partial submissions
- Remote: AddInData record per submitted report; MediaFile + ExceptionEventAttachment for each photo
- No backend database owned by this project — everything lives in MyGeotab

### Add-in registration
Inline JSON in System Settings → Add-Ins (works around AddIn entity URL validation):
```json
{
  "name": "Incident Reconstruction Engine",
  "supportEmail": "support@geotab.com",
  "version": "2.0.0",
  "items": [{
    "url": "https://rohanrajanwal.github.io/incident-addin-v2/index.html",
    "path": "DriveAppLink/",
    "menuName": {"en": "Incident Report"},
    "icon": "https://rohanrajanwal.github.io/incident-addin-v2/images/icon.svg"
  }],
  "isSigned": false
}
```
Database must have `allowUnsignedAddIn: true` while `isSigned: false`.

## 7. Success Metrics

- **Adoption**: number of reports submitted per week per database after rollout
- **Time to complete**: median driver time from "Start Report" to "Submit" (target <8 min)
- **Completeness**: % of reports with at least one photo per damaged vehicle and a narrative
- **Attachment success rate**: % of submitted reports where photos appear on the exception event page in MyGeotab (target >99%)
- **AI accuracy** (after backend connected): % of AI-classified photo angles that the driver accepts without correction (target >85%)
- **PDF use**: number of generated PDFs downloaded per report (proxy for usefulness to fleet/claims)

## 8. Open Risks & Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Geotab Drive iOS still missing mic permission | Voice narrative and in-app video stay disabled | Filed with Geotab Drive team; using library-pick fallback for video; text-only narrative |
| MediaFile storage backend behavior varies by database | Failures on demo/replay DBs (already confirmed on Demo_buildtesting16) | Test on g560 (real DB) before declaring upload solved; document supported DB types |
| Geotab CSP blocks external APIs | Cannot call third-party weather/OCR APIs directly from the iframe | All AI/inference goes through Geotab GenAI Gateway, which is on the CSP allowlist |
| Add-in unsigned | Some customers disallow unsigned add-ins by policy | Sign the add-in via Geotab's signing process before broad rollout |
| Per-customer report format expectations | Insurance/legal teams may want different fields | PDF generator is template-driven; per-customer overrides possible without code changes |
| GitHub Pages hosting | Free tier with no SLA | Acceptable for v2; move to Geotab-internal hosting if adoption requires SLA |
