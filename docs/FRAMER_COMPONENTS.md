# Framer references and local motion components

Iznera remains the local, authenticated Next.js application and its static presentation. Framer authoring and the local application are separate: edits in Framer do not automatically synchronize with GitHub or localhost. The local application has no remote Framer runtime requests, paid component subscriptions, or new third-party runtime dependencies. The references below are public component listings; this document contains no private editor links or project metadata.

## Selected references

The supplied Dots module corresponds to Michael Slotta's free [Interactive Pattern](https://www.framer.com/marketplace/components/interactive-pattern/). Its cursor-proximity pattern informed the original `astra-dots.js` implementation. The background is confined to presentation hero areas; it does not animate behind private chat or the editable engineering canvas.

For marketing navigation, the selected reference is Matt's free [Motion Overlay Menu](https://www.framer.com/marketplace/components/motion-overlay-menu/), rather than the alternative [Modern Navbar](https://www.framer.com/marketplace/components/modern-navbar/). The native implementation uses a modal dialog, a directional reveal, short link sequencing, focus restoration and reduced-motion behavior. Workspace navigation now uses the user-selected shadcn sidebar below.

The Framer listings use the [Limited license](https://www.framer.com/legal/community-terms/1.0). The remote component modules have not been republished as standalone source or embedded verbatim. The local dots and menu are original implementations of the referenced interaction ideas.

## Additional free effects

- [Magic UI Animated Beam](https://magicui.design/docs/components/animated-beam): the endpoint/curvature calculation is adapted for the existing demo graph, with its MIT copyright and permission notice retained in `astra-effects.js`. A short impulse runs after selecting a demonstration node, rather than looping continuously. The source is [animated-beam.tsx](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/animated-beam.tsx).
- [React Bits Spotlight Card](https://reactbits.dev/components/spotlight-card): visual reference for an original bounded hover spotlight. No React Bits code is copied. Its current MIT + Commons Clause license must not be described as plain MIT. See the [upstream license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md).

## Performance and accessibility

The dots have a bounded point budget and pixel ratio. They stop when hidden/offscreen or settled; coarse-pointer and reduced-motion users receive a quiet static pattern. Hover effects update at most once per animation frame. Beam animations are event-triggered and cancelled on visibility/preference changes. No effect blocks clicks or obscures text. The menu supports keyboard navigation, Escape, a visible close button and background focus isolation.

RU, EN and KK remain available. No demonstration counts, evidence, research results, saved records, account flows or team permissions are invented or replaced by this visual work.

## Language dropdown

The language selector adapts the free [Flowbite language dropdown](https://flowbite.com/docs/components/navbar/#language-dropdown) to Iznera's RU / EN / KK content, dark surfaces and native-script language names. Flowbite is [MIT licensed](https://github.com/themesberg/flowbite/blob/main/LICENSE.md); its notice is preserved in `website/tracelab/language-switcher.js`. No Flowbite runtime, external font or remote component is fetched by the site. The dropdown controller, animation and React account integration are maintained locally. The Framer [Language Scramble](https://www.framer.com/marketplace/components/language-scramble/) was also reviewed; it requires Framer Localization and is not embedded in the local application.

## Selected workspace sidebar

The user chose [shadcn Sidebar-07](https://ui.shadcn.com/view/new-york-v4/sidebar-07). The [official sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) supplies the labelled/icon layout, fixed header/footer, scrollable content and separate mobile sheet pattern. Its [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md), Copyright (c) 2023 shadcn, is retained in `workspace-sidebar.js`.

The component is adapted to the existing native workspace shell rather than mounting a second React application. Existing view buttons, route state, permissions and project controls remain authoritative; the overview, iterations, memory and handoff use the same navigation. Collapse/expand is a layout state change and does not unmount the current graph, editor or voice session. A native dialog implements the mobile sheet, preserving focus isolation and the same navigation nodes. The previous workspace overlay navigation is replaced; the marketing overlay remains separate.

## Theme switch and quick navigation — 1 November 2026

The free [Motion Minimal Navs](https://www.framer.com/marketplace/components/motion-minimal-navs/) supplied by the user is a visual reference for the sun/moon transition. Its Framer source is not embedded or redistributed. The local control uses a 260 ms icon rotation/crossfade, a short surface transition and a reduced-motion alternative. Dark/milk preference is separate from account/project data, initializes before paint and synchronizes between tabs. Switching it does not recreate the workspace, interrupt a call or discard a draft.

The free [shadcn Command](https://ui.shadcn.com/docs/components/radix/command) informed the grouped quick-navigation dialog: sections first, then records in the selected project. The native implementation in `workspace-command.js` uses existing actions and a bounded list of 40 results; there is no `cmdk` dependency, copied React source or remote search. It supports arrows, Enter, Escape, focus return, a visible sidebar button and Ctrl/Cmd+K outside editable fields. UI labels follow RU/EN/KK; authored record titles stay unchanged.
