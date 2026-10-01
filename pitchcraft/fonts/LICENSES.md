# Bundled fonts

All fonts are licensed under the **SIL Open Font License 1.1** (https://openfontlicense.org), which permits bundling, embedding and redistribution, including commercially. They are self-hosted as WOFF2 so the app works offline and from `file://`.

| File | Family | Used for | Upstream |
|---|---|---|---|
| `bricolage.woff2` | Bricolage Grotesque (variable) | Studio/Aurora display, wordmark | https://github.com/ateliertriay/bricolage |
| `instrument-serif.woff2`, `instrument-serif-italic.woff2` | Instrument Serif | Editorial display, wordmark accent | https://github.com/Instrument/instrument-serif |
| `inter.woff2` | Inter (variable) | UI and body text | https://github.com/rsms/inter |
| `syne.woff2` | Syne (variable) | Contrast and Brutal display | https://github.com/bonjour-monde/Syne |
| `jetbrains-mono.woff2` | JetBrains Mono | Code, kickers | https://github.com/JetBrains/JetBrainsMono |

Copyright remains with the respective authors; the OFL requires that the fonts are not sold on their own and that the licence travels with them — this file and the upstream links satisfy that for this repository.

## Extra families (added in 3.4.0)

Latin and Latin Extended-A subsets (variable axes other than weight pinned to their defaults) of these Google Fonts families, all SIL OFL 1.1. Source: https://github.com/google/fonts/tree/main/ofl. Each family is one `fonts/<key>.woff2` (Poppins and Lato also have `-bold`), declared in `css/fonts.css` and listed in `PC.FONTS` (`js/objects.js`). Browsers download a face only when a slide uses it.

- **Sans:** DM Sans, Manrope, Plus Jakarta Sans, Space Grotesk, Outfit, Montserrat, Work Sans, Sora, Figtree, Urbanist, Poppins, Raleway, Nunito, Lato, Rubik, Archivo, Epilogue, IBM Plex Sans, Josefin Sans, Quicksand, Cabin
- **Serif:** Playfair Display, Lora, Fraunces, Source Serif 4, Cormorant Garamond, Libre Baskerville, DM Serif Display
- **Display:** Oswald, Anton, Bebas Neue, Abril Fatface
- **Script:** Pacifico, Lobster, Caveat
- **Mono:** Space Mono, IBM Plex Mono, Fira Code, Inconsolata

Copyright remains with each family's authors (see the upstream directory for each copyright line and `OFL.txt`).
