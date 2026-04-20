# Polaroid Image Prompts

Generate these with Midjourney, DALL-E 3, or similar. Target size: 380×320px (2x = 760×640).
Style guidance for all: "polaroid photograph, slightly overexposed, warm grain, nostalgic, candid, British home, muted colour palette, soft focus edges"

## How to add images once generated

In `data/story.json`, each card has a `placeholder` field. To use a real image, add an `image` field:
```json
{
  "id": "amstrad-arrival",
  "image": "assets/images/amstrad-arrival.jpg",
  ...
}
```

The JS already checks for `card.image` before falling back to the SVG placeholder.

---

## Per-card prompts

### amstrad-arrival (1988)
`Amstrad CPC 464 home computer on a wooden desk in a British living room, 1988, warm afternoon light through net curtains, cream carpet visible, polaroid photograph style, nostalgic, grain`

### basic-before-writing (1991)
`Small child's hands on a computer keyboard, amber screen glow, BASIC code visible on monitor, evening, cosy British home, polaroid photograph, warm grain, nostalgic 1990s`

### expensive-upgrade (1993)
`IBM 486 PC with CRT monitor in British 90s bedroom, beige tower computer, Windows 3.11 interface visible on screen, bookshelf behind, polaroid photo style, grain`

### doom-cdrom (1995)
`Collection of PC game boxes and CD-ROMs spread on carpet, Doom II box prominent, 1995, British bedroom, polaroid photograph, muted colours, slightly overexposed`

### dialup-jar (1995)
`56k modem device on a wooden desk next to a telephone, 1990s British home, warm tungsten light, cable clutter, polaroid photograph style, grain, nostalgic`

### editing-worlds (1996)
`Close-up of CRT monitor showing early DOS game editor, dark room, green and grey DOS interface, piles of floppy disks nearby, polaroid photo, grain, 90s nostalgia`

### first-websites (1996)
`Old Netscape Navigator browser on Windows 95, personal homepage visible with blinking text, CRT monitor glow, late evening, polaroid photograph style, warm grain`

### icq-mirc (1998)
`mIRC chat window on Windows 98 desktop, dark chat room text, CRT monitor, desk with papers and empty mugs, late night blue glow, polaroid photo style`

### beyond-basic (1999)
`Stack of programming books — Python, C for Beginners — on a desk with a printout of code, pencil annotations, British bedroom window behind, polaroid photograph, grain`

### freelance-era (2007)
`Laptop on kitchen table with scattered client invoices and coffee mug, 2007, natural light, slightly cluttered, polaroid photograph style, muted grain`

### media-career (2010)
`Video editing timeline on a laptop screen, headphones on desk, 2010, coffee shop or home office setting, warm light, polaroid photograph style, grain`

### bbc-entry (2010)
`BBC Television Centre exterior or logo sign, 2010, overcast British sky, shot from street level, polaroid photograph style, slightly underexposed, grain`

### bbc-north-star (2012)
`Award certificate or trophy on a desk with office background, warm office lighting, 2012, slightly blurred background, polaroid photograph style, grain`

### bbc-tpm (2014)
`Red button on a TV remote control in close-up, BBC red button interface on TV screen behind, 2014, polaroid photograph style, grain`

### bbc-big-events (2015)
`Large monitor wall showing sporting event broadcast, technical operations room, 2015, cool blue broadcast lighting, polaroid photograph style, underexposed, grain`

### tv-app-year (2018)
`Cannes-style award stage or tablet showing TV streaming app, 2018, polaroid photograph style, warm grain, slightly overexposed`

### consulting-banking (2019)
`Laptop on minimal desk with financial charts on screen, open plan office or home office, 2019, morning light, polaroid photograph style, grain`

### covid-platform (2020)
`Home office during lockdown — laptop, empty coffee cups, window with grey sky outside, 2020, isolation feeling, polaroid photograph style, muted, grain`

### nhs-architecture (2021)
`Architecture diagram or whiteboard covered in NHS service flow drawings, marker pens, 2021, meeting room, polaroid photograph style, grain`

### nhs-appointments (2021)
`NHS App interface on smartphone, patient waiting area blurred behind, 2021, NHS blue colour, polaroid photograph style, grain`

### healthcall-cpto (2022)
`Hospital corridor with technology equipment, tablet on wall, clinical environment, 2022, polaroid photograph style, cool clinical light, grain`

### gpt2-moment (2023)
`Terminal window showing AI text generation, green text on dark screen, 2023, close-up, polaroid photograph style, phosphor glow, grain`

### government-ai (2024)
`Secure government laptop showing data dashboard, Ministry of Justice building exterior, 2024, polaroid photograph style, slightly formal, grain`

### current-chapter (2025)
`NHS headquarters or modern office with NHS signage, 2025, polaroid photograph style, grain, slightly overexposed sky outside`
