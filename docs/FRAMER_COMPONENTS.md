# Framer references and local motion components

Iznera remains the local, authenticated Next.js application and its static presentation. Framer authoring and the local application are separate: edits in Framer do not automatically synchronize with GitHub or localhost. The local application has no remote Framer runtime requests, paid component subscriptions, or new third-party runtime dependencies. The references below are public component listings; this document contains no private editor links or project metadata.

## Selected references

The supplied Dots module corresponds to Michael Slotta's free [Interactive Pattern](https://www.framer.com/marketplace/components/interactive-pattern/). Its cursor-proximity pattern informed the original `astra-dots.js` implementation. The background is confined to presentation hero areas; it does not animate behind private chat or the editable engineering canvas.

For navigation, the selected reference is Matt's free [Motion Overlay Menu](https://www.framer.com/marketplace/components/motion-overlay-menu/), rather than the alternative [Modern Navbar](https://www.framer.com/marketplace/components/modern-navbar/). The native implementation uses a modal dialog, a directional reveal, short link sequencing, focus restoration and reduced-motion behavior. Marketing links and workspace view selection use actual Iznera routes and controls.

The Framer listings use the [Limited license](https://www.framer.com/legal/community-terms/1.0). The remote component modules have not been republished as standalone source or embedded verbatim. The local dots and menu are original implementations of the referenced interaction ideas.

## Additional free effects

- [Magic UI Animated Beam](https://magicui.design/docs/components/animated-beam): the endpoint/curvature calculation is adapted for the existing demo graph, with its MIT copyright and permission notice retained in `astra-effects.js`. A short impulse runs after selecting a demonstration node, rather than looping continuously. The source is [animated-beam.tsx](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/animated-beam.tsx).
- [React Bits Spotlight Card](https://reactbits.dev/components/spotlight-card): visual reference for an original bounded hover spotlight. No React Bits code is copied. Its current MIT + Commons Clause license must not be described as plain MIT. See the [upstream license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md).

## Performance and accessibility

The dots have a bounded point budget and pixel ratio. They stop when hidden/offscreen or settled; coarse-pointer and reduced-motion users receive a quiet static pattern. Hover effects update at most once per animation frame. Beam animations are event-triggered and cancelled on visibility/preference changes. No effect blocks clicks or obscures text. The menu supports keyboard navigation, Escape, a visible close button and background focus isolation.

RU, EN and KK remain available. No demonstration counts, evidence, research results, saved records, account flows or team permissions are invented or replaced by this visual work.
