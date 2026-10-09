---
name: TraceLab / Powder adaptation
description: The selected Powder landscape and dark work surfaces, adapted for an engineering-history presentation.
colors:
  page: "#080909"
  surface: "#151718"
  ink: "#f4f2ef"
  muted: "#b4b6b5"
  line: "#303334"
  accent: "#d3e6b7"
  button-ink: "#17191a"
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
rounded:
  stage: "7px"
  source: "10px"
  surface: "16px"
  viewport: "24px"
  button: "30px"
spacing:
  control-inline: "24px"
  work: "30px"
  gutter: "32px"
  gutter-mobile: "20px"
  section: "120px"
  section-mobile: "76px"
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
---

# Design System: TraceLab / Powder adaptation

## Overview

**Creative North Star: "The selected Powder landscape and engineering work surface"**

This is a scoped adaptation of the user's selected Powder template. Its warm dusk landscape, centered hero, spacious sections and near-black surfaces remain the visual authority. Local Inter and the existing TraceLab icon preserve that continuity.

The engineering example sits in a restrained graphite viewport. Muted metadata, tabular measurements and explicit evidence states give the presentation its working character. This record describes the shipped presentation in `build.mjs`, `tracelab.css` and `tracelab.js`; it does not define a replacement identity or the main application's visual system.

**Key Characteristics:**
- Retained transparent landscape layers behind the dusk hero.
- Near-black page, graphite work surfaces and pale green evidence accents.
- Local Inter for Cyrillic and Latin, with compact engineering metadata.
- Spacious sections, rounded work surfaces and pill actions.
- One visible record updated through four evidence stages.

## Colors

Warm imagery sits over cool dark neutrals; the existing icon supplies the pale green accent.

### Primary
- **Evidence green** (`accent`): linked-source actions, status dots, export feedback, selection and keyboard focus; also the primary button's hover state.

### Neutral
- **Near-black page** (`page`): continuous page background and the hero's lower fade.
- **Graphite surface** (`surface`): the interactive engineering viewport.
- **Warm foreground** (`ink`): headings, main text and primary action fill.
- **Quiet secondary** (`muted`): descriptions and supporting context.
- **Structural line** (`line`): work-surface divisions, tables and editorial rows.
- **Button dark** (`button-ink`): text on the light primary action.

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

**The One Family Rule.** Keep local Inter across the presentation and use tabular figures for engineering values.

## Layout

The main container is capped at 1120px with 32px side gutters. The hero work preview is capped at 960px, the standalone demo at 1000px and editorial material at 900px. Default section padding is 120px per side vertically, changing to 76px at 800px. Individual narrative sections use the smaller overrides present in the stylesheet.

Desktop content alternates centered hero and closing blocks with split explanatory sections and divided editorial rows. At 1050px split-section gaps contract. At 800px the header becomes a disclosure, gutters become 20px, major splits stack and capabilities retain two columns. At 520px capabilities stack and record content becomes one column. The compact home preview hides its image context at that width; the full demo retains a small source thumbnail. The four stage controls remain visible and reachable.

The selected home sequence is hero and educational preview, rationale problem, evidence workflow, supported capabilities, research method, concise FAQ and closing demo action. `/demo`, `/research` and `/materials` provide the necessary supporting detail. This is the presentation's surface composition, not a required sequence for future interfaces.

## Elevation & Depth

The shipped interface has no box-shadow vocabulary. Tonal backgrounds, thin borders, the retained landscape layers and its soft masks provide depth. Work content stays visible at rest. State transitions use a short background/color change; the arriving record briefly clears a blur. Reduced-motion preferences disable animation and transitions and replace smooth scrolling with immediate scrolling.

**The Tonal Depth Rule.** Reuse the observed dark surfaces and divisions for hierarchy; preserve the landscape's original transparent contours.

## Shapes

Primary and outline actions are pills. Standard work surfaces use the surface radius; the large engineering viewport uses the viewport radius on desktop and the surface radius at 800px. Source thumbnails use the source radius, and evidence stages use the smaller stage radius. The mobile navigation disclosure uses 14px corners. Editorial lists and tables stay flat with thin horizontal divisions.

## Components

### Buttons
- **Primary:** warm foreground fill with dark text, 13px text at weight 500, frontmatter padding and a minimum 47px height. Hover uses evidence green.
- **Outline:** transparent fill, foreground text and a quiet `#484d48` border; hover uses `#29322b` with a `#71806c` border.
- **Text:** understated pale text with an underline on hover; source actions use evidence green.
- **Focus / press:** a two-pixel evidence-green outline offset by five pixels; actions move down one pixel while pressed. Button transitions last 0.2 seconds with the shared easing.

### Status labels
The educational-data label is a compact rounded rectangle with the frontmatter's translucent fill, secondary text and padding. Evidence dots and plain status text reinforce the record's meaning. These labels carry actual state or provenance.

### Cards / Containers
The work viewport has a graphite fill, a translucent light border and clipped rounded corners. Its header, four-stage selector, record and footer are divided internally. Desktop record padding is 30px, narrowing to 22px then 19px. Other retained surfaces use quiet green-black fills and the surface radius; they do not require nested card frames.

### Navigation
The desktop header has 13px links and a subdued pill demo action; active and hovered links brighten. At 800px the labeled menu button controls a dark disclosure. Escape closes it and returns focus to the toggle; activating a link also closes it.

### Evidence record
Four stages update one authored record and its linked test or decision. Stage selection uses a darker filled control and foreground text. Left/right arrows, Home and End support keyboard selection with a single tab stop. Inspecting a source opens its explanation inline; selecting a stage closes that explanation.

Replay advances every three seconds and can be stopped; changing the stage or inspecting a source stops replay. The educational disclaimer remains visible. Missing evidence receives explicit text, and successful HTML/JSON sample exports announce their status. These are presentation interactions, not authenticated application flows.

## Do's and Don'ts

### Do:
- **Do** preserve local Inter, the existing TraceLab icon, the selected dusk landscape and its transparent contours.
- **Do** keep engineering measurements tabular and distinguish evidence, authorship and missing information.
- **Do** preserve visible content, keyboard focus and reduced-motion behavior.
- **Do** use the established pills, surface radii and spacious container rhythm when extending this presentation.

### Don't:
- **Don't** replace the approved Powder visual world while adapting this presentation.
- **Don't** add pricing grids, invented testimonials, unsupported metrics or unrelated SaaS forms to this scoped site.
- **Don't** disguise synthetic example measurements as research results.
