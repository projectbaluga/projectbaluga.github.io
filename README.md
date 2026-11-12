# Wilson Villanueva — Portfolio

Personal portfolio and service overview for ProjectBaluga.

Built with plain HTML, CSS, and JavaScript. No build step or package installation is required.

## Purpose

The site presents three service areas:

- Custom business systems and workflow software
- Network and MikroTik solutions
- Custom software and infrastructure automation

The selected-work section links to independent projects as examples of technical experience. They are not presented as paid client engagements or as evidence of unverified business outcomes.

## Files

- `index.html` — page markup, service descriptions, selected projects, and contact links
- `styles.css` — styling, responsive layouts, and animations
- `script.js` — navigation, carousel, lightbox, scroll reveals, and theme toggle
- `assets/` — screenshots, avatar, favicons, and social image

## Local preview

Open `index.html` in a browser, or serve the repository with any static file server.

## Contact

[projectbaluga@gmail.com](mailto:projectbaluga@gmail.com)


## AI assistant

The optional ProjectBaluga AI assistant uses a Cloudflare Worker backend. See `cloudflare/README.md` for deployment and configuration. The browser widget remains disconnected until its `data-api-url` is set to the deployed Worker origin.

### Smart mascot

The assistant's character (`assets/mascot-expressions.svg`, six expressions: `idle`, `thinking`, `responding`, `success`, `error`, `offline`) is driven by `mascot.js` and styled in `mascot.css`.

- **Idle life** – breathing, blinking, small head tilts, and an occasional curious or cheerful look. The newest assistant avatar in the chat breathes and blinks as well; older messages stay still.
- **Pointer / touch** – leans toward the cursor, a touch, or the feature card being hovered.
- **Chat** – nods while the visitor types, shows concern for messages about problems (and stays calm afterwards instead of celebrating), and smiles at greetings and thanks (English and Filipino keywords live in `classifyMessage`).
- **Page** – reacts when sections scroll into view, shows at most two short hint bubbles per session, and waves once on a first visit (remembered in `localStorage`; nothing is stored if storage is blocked).
- **Accessibility** – all ambient motion, hints and the greeting are disabled under `prefers-reduced-motion`; hint bubbles are decorative (`aria-hidden`) and the chat itself is unchanged.

`script.js` only reports chat state to the mascot through `window.PBMascot`; without `mascot.js` it falls back to plain expression swaps. Tests: `npm test`.
