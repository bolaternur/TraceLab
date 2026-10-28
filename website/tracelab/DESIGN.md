---
name: Iznera / Powder adaptation
description: The selected Powder landscape and dark work surfaces, adapted for an engineering-history presentation.
colors:
  page: "#080909"
  surface: "#151718"
  ink: "#f4f2ef"
  muted: "#b4b6b5"
  line: "#303334"
  accent: "#d3e6b7"
  button-ink: "#17191a"
  operate-surface: "#151a17"
  field: "#181c1b"
  field-line: "#444b46"
  evidence-pending: "#c9b493"
  workbench-bar: "#121615"
  canvas-surface: "#101412"
  canvas-node: "#202724"
  canvas-node-line: "#5b685d"
  inspector-surface: "#171d18"
  workbench-action-ink: "#182015"
typography:
  display:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "clamp(40px, 4.4vw, 62px)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "clamp(30px, 3.25vw, 44px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.6
  canvas-title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.015em"
rounded:
  stage: "7px"
  source: "10px"
  surface: "16px"
  viewport: "24px"
  button: "30px"
  field: "8px"
  plot: "4px"
  canvas-node: "12px"
spacing:
  control-inline: "24px"
  work: "30px"
  gutter: "32px"
  gutter-mobile: "20px"
  section: "120px"
  section-mobile: "76px"
  operate-gap: "22px"
  inspector: "24px"
  workbench-inspector: "21px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.button-ink}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-text:
    backgroundColor: "transparent"
    textColor: "#e3e4e2"
    rounded: "{rounded.button}"
    padding: "13px 8px"
  work-viewport:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.viewport}"
  work-viewport-mobile:
    rounded: "{rounded.surface}"
  stage-control:
    textColor: "{colors.muted}"
    rounded: "{rounded.stage}"
    padding: "10px 8px"
  educational-label:
    backgroundColor: "#ffffff0b"
    textColor: "#c4c7c3"
    rounded: "4px"
    padding: "3px 7px"
  operate-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  operate-inspector:
    backgroundColor: "{colors.operate-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.inspector}"
  operate-tab:
    backgroundColor: "transparent"
    textColor: "#b9c2b9"
    rounded: "26px"
    padding: "11px 16px"
  operate-tab-selected:
    backgroundColor: "#273229"
    textColor: "{colors.ink}"
    rounded: "26px"
    padding: "11px 16px"
  workbench-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.workbench-action-ink}"
    rounded: "{rounded.stage}"
    padding: "6px 13px"
    height: "34px"
  workbench-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.stage}"
    padding: "5px 10px"
    height: "34px"
  workbench-inspector:
    backgroundColor: "{colors.inspector-surface}"
    textColor: "{colors.ink}"
    rounded: "0px"
    padding: "{spacing.workbench-inspector}"
    width: "360px"
  workbench-rail-selected:
    backgroundColor: "#293329"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "8px 0px"
  canvas-node:
    backgroundColor: "{colors.canvas-node}"
    textColor: "{colors.ink}"
    typography: "{typography.canvas-title}"
    rounded: "{rounded.canvas-node}"
    padding: "17px 19px"
    width: "250px"
    height: "156px"
---

# Design System: Iznera / Powder adaptation

## Overview

**Creative North Star: "The selected Powder landscape and engineering work surface"**

This is a scoped adaptation of the user's selected Powder template. Its warm dusk landscape, centered hero, spacious sections and near-black surfaces remain the visual authority. Local Inter preserves interface continuity. The user-approved mechanical Iznera wordmark keeps its transparent background and appears directly on the existing shell, without a white plaque, light panel or surrounding frame.

The engineering example sits in a restrained graphite viewport. Muted metadata, tabular measurements and explicit evidence states give the presentation its working character. The local workspace extends this system into a full-viewport workbench with compact project controls, movable linked records and measured diagrams. This record describes the shipped presentation and local workspace in `build.mjs`, `tracelab.css`, `tracelab.js`, `workspace-surface.mjs`, `workspace.css`, `workspace-views.css`, `workspace-shell.css`, `workspace-canvas.css` and `workspace-canvas.js`; it does not define a replacement identity or the server application's visual system.

**Key Characteristics:**
- Retained transparent landscape layers behind the dusk hero.
- Near-black page, graphite work surfaces and pale green evidence accents.
- Local Inter for Cyrillic and Latin, with compact engineering metadata.
- Spacious sections, rounded work surfaces and pill actions.
- One visible record updated through four evidence stages.
- Full-viewport working views with movable evidence, labeled connections and optional record context.

## Colors

Warm imagery sits over cool dark neutrals; the existing icon supplies the pale green accent.

### Primary
- **Evidence green** (`accent`): linked-source actions, status dots, export feedback, selection and keyboard focus; also the primary button's hover state.

### Secondary
- **Pending evidence sand** (`evidence-pending`): suggested graph connections and their arrows. A dashed line and explicit confirmation text accompany the color.

### Neutral
- **Near-black page** (`page`): continuous page background and the hero's lower fade.
- **Graphite surface** (`surface`): the interactive engineering viewport.
- **Warm foreground** (`ink`): headings, main text and primary action fill.
- **Quiet secondary** (`muted`): descriptions and supporting context.
- **Structural line** (`line`): work-surface divisions, tables and editorial rows.
- **Button dark** (`button-ink`): text on the light primary action.
- **Working inset** (`operate-surface`): the record inspector, dialogs and compact connection preview.
- **Field dark** (`field`): editable input, select and textarea backgrounds.
- **Field boundary** (`field-line`): the quiet stroke that makes editable fields distinguishable from surrounding working surfaces.
- **Workbench bar** (`workbench-bar`): the compact project bar and vertical utility rail.
- **Canvas dark** (`canvas-surface`): the spatial evidence surface, with a quiet dotted coordinate grid.
- **Node graphite** (`canvas-node`): movable evidence records; **Node boundary** (`canvas-node-line`) separates them from the canvas at rest.
- **Inspector dark** (`inspector-surface`): the docked record panel and its mobile drawer.
- **Workbench action dark** (`workbench-action-ink`): text on the compact green capture action.

**The Evidence Accent Rule.** Green identifies evidence, interaction or state; broad page surfaces remain dark.

The hero's implemented atmosphere is `linear-gradient(180deg, #242e34 0%, #354046 32%, #725b5d 69%, #a48172 100%)`. This is an imagery treatment, not a second UI accent palette. Landscape contours retain their transparency and fade through a vertical mask. The retained `--inset: #1e2021` root declaration has no current consuming selector; it is not promoted to a normative primitive.

## Typography

**Display Font:** local Inter, with Arial and sans-serif fallbacks.
**Body Font:** the same local Inter stack.

The display is medium-weight and tightly tracked. Body copy is quieter, with plain sentence-case labels and tabular figures on versions, timestamps and measurements.

### Hierarchy
- **Display:** the frontmatter's display role for default page headings. At widths up to 800px the hero uses `clamp(34px, 5.4vw, 47px)`; up to 520px it uses 36px with 1.18 line height. Interior page headings are 43px then 36px at those breakpoints.
- **Headline:** the frontmatter's headline role for section headings; selected intro, closing and editorial surfaces use local size overrides.
- **Title:** the frontmatter's title role for section subheads; engineering record titles range from 19px to 25px by surface and width.
- **Body:** the frontmatter's body role is the base. Hero leads use 16px / 1.55, compact explanations usually 13px / 1.6, and editorial prose 1.75 line height. Typical explanatory measures are 53–72ch.
- **Label:** the frontmatter's label role for secondary status and metadata; final record metadata and details use 12px on desktop, with specific mobile overrides. These are functional labels, not decorative headings.

Embedded working walkthroughs retain their 32px / 1.2 title with tight tracking, changing to 29px at 800px and 27px at 520px. The full-viewport workbench uses a compact 14px project heading and 20px inspector headings. Working controls and explanatory text use 12–14px; canvas relation labels and chart axes use 12px. Movable node titles use the frontmatter's canvas-title role; their IDs and type metadata use 11px / 1.5, with 12px / 1.5 detail text. Highlighted test values remain 19–21px. Dates, record IDs, zoom percentages and measurements remain tabular. These compact roles belong to working views rather than replacing the presentation's display scale.

**The One Family Rule.** Keep local Inter across the presentation and use tabular figures for engineering values.

## Layout

The main container is capped at 1120px with 32px side gutters. The hero work preview is capped at 960px, the standalone demo at 1000px and editorial material at 900px. Default section padding is 120px per side vertically, changing to 76px at 800px. Individual narrative sections use the smaller overrides present in the stylesheet.

Desktop content alternates centered hero and closing blocks with split explanatory sections and divided editorial rows. At 1050px split-section gaps contract. At 800px the header becomes a disclosure, gutters become 20px, major splits stack and capabilities retain two columns. At 520px capabilities stack and record content becomes one column. The compact home preview hides its image context at that width; the full demo retains a small source thumbnail. The four stage controls remain visible and reachable.

The selected home sequence is hero and educational preview, rationale problem, evidence workflow, supported capabilities, research method, concise FAQ and closing demo action. `/demo`, `/research` and `/materials` provide the necessary supporting detail. This is the presentation's surface composition, not a required sequence for future interfaces.

The primary workspace fills the viewport (100dvh), has no container cap or outer page gutter, and omits the presentation header and footer. Its rows are a 58px project bar, 31px provenance notice, flexible working area and 30px status bar. A 56px vertical utility rail sits beside the active view. Search, type selection and relation actions occupy the compact toolbar immediately above the working area. The evidence view fills the remaining space. The inspector opens on selection, can be closed, and docks without an inter-column gap; its default width is 360px with a 280–520px resize range. Pointer dragging and left/right arrows resize the divider. The paired-measurement view uses the full work area without an inspector.

At 800px the project bar becomes 55px high, its controls condense, the toolbar wraps, and the inspector becomes a bottom drawer capped at 68% of the work area. At 700px the canvas initially exposes its readable record-and-relation list; diagram controls remain available. At 480px the rail keeps its 56px width and reduces its internal padding. Internal views, the list and the inspector scroll independently; the page itself remains fixed to the viewport.

The earlier 1320px bounded layout, horizontal pill tabs, 330px inspector and stacked compact-screen context remain reference patterns for embedded working walkthroughs. They are not the layout of the primary workspace and must not be inherited by new full-viewport workbench views.

The primary graph uses a transformed spatial canvas with explicit zoom/fit controls, background panning, draggable records and a small minimap. HTML node bounds determine SVG connection endpoints so lines follow node movement. Zoom anchors to the pointer or viewport center. Saved record coordinates restore from the project data. Embedded graph previews retain their own scrollable viewport. Research charts retain a 640px minimum plot width inside a horizontal scroller; tables use a separate horizontal scroller. Timeline rows move from date/content columns to one column at 700px.

**The Working Context Rule.** Keep the active record's provenance, explanation and related evidence in a closable dock beside full-viewport working views on wide screens and in a bottom drawer on compact screens. Embedded walkthroughs may place that context immediately below the view.

**The Viewport Workbench Rule.** Let the primary working surface occupy the available viewport; contain scrolling within the active view and context panel.

## Elevation & Depth

The presentation and desktop workbench use tonal backgrounds, thin borders, the retained landscape layers and its soft masks for depth. The compact-screen inspector drawer adds one upward ambient shadow (`0 -15px 35px #04080460`) to distinguish its overlap with the canvas. This overlay treatment does not introduce shadows on ordinary cards or nodes. Work content stays visible at rest. State transitions use a short background/color change; the arriving example record briefly clears a blur. Reduced-motion preferences disable animation and transitions and replace smooth scrolling with immediate scrolling.

**The Tonal Depth Rule.** Reuse the observed dark surfaces and divisions for hierarchy; preserve the landscape's original transparent contours.

## Shapes

Primary and outline actions are pills. Standard work surfaces use the surface radius; the large engineering viewport uses the viewport radius on desktop and the surface radius at 800px. Source thumbnails use the source radius, and evidence stages use the smaller stage radius. The mobile navigation disclosure uses 14px corners. Editorial lists and tables stay flat with thin horizontal divisions.

Embedded working tabs keep pill silhouettes; fields use the field radius and test tracks use the smaller plot radius. The full-viewport shell and docked inspector have square exterior corners. Its compact toolbar controls use the stage radius; utility actions use the field radius. Canvas nodes are rounded rectangles using the canvas-node radius, with circular input/output ports and thin directed connections. The node frame encloses one record; relationships and table rows supply the remaining structure without enclosing every fact in another card.

## Components

### Buttons
- **Primary:** warm foreground fill with dark text, 13px text at weight 500, frontmatter padding and a minimum 47px height. Hover uses evidence green.
- **Outline:** transparent fill, foreground text and a quiet `#484d48` border; hover uses `#29322b` with a `#71806c` border.
- **Text:** understated pale text with an underline on hover; source actions use evidence green.
- **Focus / press:** a two-pixel evidence-green outline offset by five pixels; actions move down one pixel while pressed. Button transitions last 0.2 seconds with the shared easing.
- **Workbench capture action:** compact evidence-green fill, dark text and stage-radius corners, with the workbench-primary padding and height. Hover lightens the green. This working action complements the presentation's larger pill buttons.

### Status labels
The educational-data label is a compact rounded rectangle with the frontmatter's translucent fill, secondary text and padding. Evidence dots and plain status text reinforce the record's meaning. These labels carry actual state or provenance.

### Cards / Containers
The presentation work viewport has a graphite fill, a translucent light border and clipped rounded corners. Its header, four-stage selector, record and footer are divided internally. Desktop record padding is 30px, narrowing to 22px then 19px. The primary workbench replaces the bounded outer frame with viewport-filling surfaces and thin bar/panel divisions. Retained walkthrough surfaces use quiet green-black fills and the surface radius; they do not require nested card frames.

### Navigation
The desktop header has 13px links and a subdued pill demo action; active and hovered links brighten. At 800px the labeled menu button controls a dark disclosure. Escape closes it and returns focus to the toggle; activating a link also closes it.

### Working fields and dialogs
Fields use the frontmatter's working fill, boundary, radius and padding with 13px / 1.5 Inter. Focus uses a two-pixel evidence-green outline offset by three pixels. Dialogs reuse the working inset and surface radius, with a dim backdrop and internal scrolling. Their two-column forms stack at 520px; validation feedback appears next to the form rather than as a decorative badge.

The workbench search and type controls use the workbench-field variant, with 12px text, a 34px height and stage-radius corners. Their compact treatment does not change the larger dialog fields.

### Working view tabs
Embedded view selection uses a darker green-toned pill, a visible border and foreground text. The primary workbench instead uses a vertical icon-and-label utility rail. Its selected action has a darker green-toned fill, visible border and evidence-green foreground; hovered actions brighten. Captions use the 11px label role beneath 21px icons, including on phones. Up/down and left/right arrows, Home and End navigate the rail with one keyboard tab stop. Each icon has an explicit accessible name. The rail scrolls vertically when needed.

### Evidence graph and inspector
Movable HTML nodes retain an ID, type, readable title and compact detail. Each uses the frontmatter's 250px by 156px canvas-node geometry. Selection strengthens the evidence-green stroke; unrelated records recede. Accepted SVG connections use solid directed lines, suggested connections use sand-colored dashed lines, and the selected record's links use the evidence accent. Relationship labels and the record-and-relation list supply meaning alongside the diagram. Enter selects a focused node; arrows move it, while Space enables hand/pan mode. Circular input/output ports expose 44px targets around 12px visible dots. A port-to-port drag opens the directed relation form; the toolbar form supplies the same action without dragging.

The docked inspector groups record details with thin divisions and text-led related-record actions. Its header exposes a close action; closing restores the view's space. Content uses workbench-inspector padding on desktop and 18px in the compact drawer. Missing authorship, explanation or supporting tests receive explicit text. Annotation history sits in a disclosure, preserving the compact working view. Embedded walkthrough inspectors retain their rounded inset treatment.

### Test and research diagrams
Tests use horizontal evidence-green bars with a printed value, context and units. Each test row can select its record. Research measurements use neutral baseline dots and evidence-green Iznera dots joined by a line; a legend, participant codes, numeric axis and disclosed table keep comparisons readable. Empty views provide a written next action. These encodings describe entered data rather than supplying research claims.

**The Evidence Encoding Rule.** Accompany diagram color with labels, printed values and a text or table path; distinguish suggested relations through both dashed strokes and explicit status.

### Evidence record
Four stages update one authored record and its linked test or decision. Stage selection uses a darker filled control and foreground text. Left/right arrows, Home and End support keyboard selection with a single tab stop. Inspecting a source opens its explanation inline; selecting a stage closes that explanation.

Replay advances every three seconds and can be stopped; changing the stage or inspecting a source stops replay. The educational disclaimer remains visible. Missing evidence receives explicit text, and successful HTML/JSON sample exports announce their status. These are presentation interactions, not authenticated application flows.

## Do's and Don'ts

### Do:
- **Do** preserve local Inter, the supplied Iznera wordmark, the selected dusk landscape and its transparent contours.
- **Do** keep engineering measurements tabular and distinguish evidence, authorship and missing information.
- **Do** preserve visible content, keyboard focus and reduced-motion behavior.
- **Do** use the established pills, surface radii and spacious container rhythm when extending this presentation.
- **Do** use compact controls and adjacent record context for working views while retaining the presentation's palette and type family.
- **Do** fill the primary workspace viewport, keep the inspector closable, and use readable lists plus a bottom drawer on compact screens.
- **Do** retain units, readable diagram labels and a text or table alternative when presenting evidence.

### Don't:
- **Don't** replace the approved Powder visual world while adapting this presentation.
- **Don't** add pricing grids, invented testimonials, unsupported metrics or unrelated SaaS forms to this scoped site.
- **Don't** disguise synthetic example measurements as research results.
