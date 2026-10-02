// ── Placeholder image generators ──
const PLACEHOLDERS = {
  amstrad(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#c8b89a"/>
      <rect x="${w*.15}" y="${h*.08}" width="${w*.7}" height="${h*.52}" rx="4" fill="#b0a888"/>
      <rect x="${w*.18}" y="${h*.11}" width="${w*.64}" height="${h*.44}" fill="#0a180a"/>
      <rect x="${w*.2}" y="${h*.14}" width="${w*.6}" height="${h*.38}" fill="#050d05"/>
      <defs><clipPath id="sc"><rect x="${w*.2}" y="${h*.14}" width="${w*.6}" height="${h*.38}"/></clipPath></defs>
      <g clip-path="url(#sc)">
        <text x="${w*.23}" y="${h*.29}" font-family="monospace" font-size="${h*.08}" fill="#33dd55">10 PRINT "HELLO"</text>
        <text x="${w*.23}" y="${h*.39}" font-family="monospace" font-size="${h*.08}" fill="#33dd55">20 GOTO 10</text>
        <text x="${w*.23}" y="${h*.49}" font-family="monospace" font-size="${h*.08}" fill="#1a8c32">RUN</text>
      </g>
      <rect x="${w*.3}" y="${h*.64}" width="${w*.4}" height="${h*.06}" rx="2" fill="#9a9280"/>
      <rect x="${w*.1}" y="${h*.72}" width="${w*.8}" height="${h*.22}" rx="3" fill="#b8b0a0"/>
      <rect x="${w*.14}" y="${h*.78}" width="${w*.5}" height="${h*.08}" rx="1" fill="#2a261e" opacity=".6"/>
    </svg>`;
  },
  basic(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#f0e8d0"/>
      <rect x="${w*.1}" y="${h*.08}" width="${w*.8}" height="${h*.85}" fill="#faf6ea" stroke="#d4c89a" stroke-width="1"/>
      <text x="${w*.15}" y="${h*.2}" font-family="monospace" font-size="${h*.07}" fill="#3a3020">10 REM MATT'S FIRST</text>
      <text x="${w*.15}" y="${h*.3}" font-family="monospace" font-size="${h*.07}" fill="#3a3020">20 FOR I=1 TO 10</text>
      <text x="${w*.15}" y="${h*.4}" font-family="monospace" font-size="${h*.07}" fill="#3a3020">30 PRINT I</text>
      <text x="${w*.15}" y="${h*.5}" font-family="monospace" font-size="${h*.07}" fill="#3a3020">40 NEXT I</text>
      <text x="${w*.15}" y="${h*.6}" font-family="monospace" font-size="${h*.07}" fill="#3a3020">50 END</text>
      <line x1="${w*.1}" y1="${h*.7}" x2="${w*.9}" y2="${h*.7}" stroke="#d4c89a" stroke-width="1"/>
      <text x="${w*.15}" y="${h*.82}" font-family="monospace" font-size="${h*.065}" fill="#9a8e70">age 4-5, amstrad</text>
    </svg>`;
  },
  ibm486(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#b8b0a0"/>
      <rect x="${w*.08}" y="${h*.05}" width="${w*.84}" height="${h*.6}" rx="3" fill="#c0b8a8"/>
      <rect x="${w*.11}" y="${h*.08}" width="${w*.78}" height="${h*.52}" fill="#181410"/>
      <rect x="${w*.14}" y="${h*.1}" width="${w*.72}" height="${h*.46}" fill="#101008"/>
      <image href="assets/images/logos/ibm-logo.svg" x="${w*.22}" y="${h*.18}" width="${w*.56}" height="${h*.22}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.48}" font-family="monospace" font-size="${h*.07}" fill="#666666" text-anchor="middle">486SX · Windows 3.11</text>
      <rect x="${w*.3}" y="${h*.68}" width="${w*.4}" height="${h*.06}" rx="2" fill="#aaa8a0"/>
      <rect x="${w*.05}" y="${h*.76}" width="${w*.9}" height="${h*.2}" rx="2" fill="#c4bfb0"/>
    </svg>`;
  },
  cdrom(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#1a0800"/>
      <rect x="${w*.1}" y="${h*.1}" width="${w*.8}" height="${h*.55}" rx="2" fill="#0a0400"/>
      <text x="${w*.5}" y="${h*.38}" font-family="Impact, sans-serif" font-size="${h*.22}" fill="#cc2200" text-anchor="middle" font-weight="bold" letter-spacing="-0.02em">DOOM</text>
      <text x="${w*.5}" y="${h*.55}" font-family="Impact, sans-serif" font-size="${h*.14}" fill="#aa1100" text-anchor="middle" font-weight="bold">II</text>
      <text x="${w*.5}" y="${h*.76}" font-family="monospace" font-size="${h*.06}" fill="#884400" text-anchor="middle">Hell on Earth</text>
      <text x="${w*.5}" y="${h*.88}" font-family="monospace" font-size="${h*.055}" fill="#553300" text-anchor="middle">id Software · 1994</text>
    </svg>`;
  },
  modem(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#2a2018"/>
      <rect x="${w*.1}" y="${h*.2}" width="${w*.8}" height="${h*.4}" rx="4" fill="#3a3020"/>
      <circle cx="${w*.2}" cy="${h*.4}" r="${w*.04}" fill="#00aa00"/>
      <circle cx="${w*.3}" cy="${h*.4}" r="${w*.04}" fill="#006600"/>
      <circle cx="${w*.4}" cy="${h*.4}" r="${w*.04}" fill="#00aa00"/>
      <circle cx="${w*.5}" cy="${h*.4}" r="${w*.04}" fill="#006600"/>
      <circle cx="${w*.6}" cy="${h*.4}" r="${w*.04}" fill="#00aa00"/>
      <text x="${w*.5}" y="${h*.72}" font-family="monospace" font-size="${h*.07}" fill="#8a7a60" text-anchor="middle">28.8k baud</text>
      <text x="${w*.5}" y="${h*.82}" font-family="monospace" font-size="${h*.065}" fill="#5a4a38" text-anchor="middle">paid by the minute</text>
    </svg>`;
  },
  wad(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#1a1008"/>
      <rect x="${w*.08}" y="${h*.08}" width="${w*.5}" height="${h*.65}" rx="2" fill="#2a1808"/>
      <rect x="${w*.1}" y="${h*.1}" width="${w*.46}" height="${h*.61}" fill="#0a0804"/>
      <text x="${w*.33}" y="${h*.32}" font-family="monospace" font-size="${h*.09}" fill="#cc4400" text-anchor="middle">E1M1</text>
      <text x="${w*.33}" y="${h*.43}" font-family="monospace" font-size="${h*.07}" fill="#884400" text-anchor="middle">MODIFIED</text>
      <text x="${w*.33}" y="${h*.54}" font-family="monospace" font-size="${h*.065}" fill="#553300" text-anchor="middle">.WAD</text>
      <rect x="${w*.62}" y="${h*.15}" width="${w*.3}" height="${h*.5}" rx="2" fill="#1a1408" stroke="#3a2808" stroke-width="1"/>
      <text x="${w*.77}" y="${h*.35}" font-family="monospace" font-size="${h*.065}" fill="#664400" text-anchor="middle">MAP</text>
      <text x="${w*.77}" y="${h*.46}" font-family="monospace" font-size="${h*.065}" fill="#664400" text-anchor="middle">EDIT</text>
    </svg>`;
  },
  website96(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#c0c0c0"/>
      <rect x="${w*.04}" y="${h*.04}" width="${w*.92}" height="${h*.92}" fill="#c8c8c8" stroke="#888" stroke-width="1"/>
      <rect x="${w*.04}" y="${h*.04}" width="${w*.92}" height="${h*.12}" fill="#000080"/>
      <text x="${w*.08}" y="${h*.13}" font-family="sans-serif" font-size="${h*.07}" fill="white">Matt's Homepage !!</text>
      <rect x="${w*.06}" y="${h*.18}" width="${w*.88}" height="${h*.04}" fill="#999"/>
      <text x="${w*.08}" y="${h*.3}" font-family="sans-serif" font-size="${h*.08}" fill="#000080">WELCOME 2 MY PAGE</text>
      <text x="${w*.08}" y="${h*.42}" font-family="sans-serif" font-size="${h*.06}" fill="#000">Under construction...</text>
      <rect x="${w*.08}" y="${h*.5}" width="${w*.2}" height="${h*.12}" fill="#ffff00" stroke="#000" stroke-width="1"/>
      <text x="${w*.18}" y="${h*.59}" font-family="sans-serif" font-size="${h*.065}" fill="#000" text-anchor="middle">NEW!</text>
    </svg>`;
  },
  mirc(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#1a1818"/>
      <rect x="${w*.04}" y="${h*.04}" width="${w*.92}" height="${h*.92}" fill="#000000"/>
      <text x="${w*.06}" y="${h*.18}" font-family="monospace" font-size="${h*.075}" fill="#aaaaaa">[#chat]</text>
      <text x="${w*.06}" y="${h*.3}" font-family="monospace" font-size="${h*.065}" fill="#00aaaa">&lt;m4tt&gt; anyone know</text>
      <text x="${w*.06}" y="${h*.4}" font-family="monospace" font-size="${h*.065}" fill="#00aaaa">how to compile</text>
      <text x="${w*.06}" y="${h*.5}" font-family="monospace" font-size="${h*.065}" fill="#aa0000">&lt;root&gt; yes</text>
      <text x="${w*.06}" y="${h*.6}" font-family="monospace" font-size="${h*.065}" fill="#aaaaaa">*** joins: n00b</text>
      <text x="${w*.06}" y="${h*.78}" font-family="monospace" font-size="${h*.065}" fill="#ffffff">mIRC 5.91</text>
    </svg>`;
  },
  code(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#1e1e1e"/>
      <text x="${w*.05}" y="${h*.18}" font-family="monospace" font-size="${h*.075}" fill="#569cd6">def </text>
      <text x="${w*.22}" y="${h*.18}" font-family="monospace" font-size="${h*.075}" fill="#dcdcaa">hello</text>
      <text x="${w*.05}" y="${h*.3}" font-family="monospace" font-size="${h*.075}" fill="#ce9178">  "world"</text>
      <text x="${w*.05}" y="${h*.45}" font-family="monospace" font-size="${h*.075}" fill="#6a9955"># build break</text>
      <text x="${w*.05}" y="${h*.57}" font-family="monospace" font-size="${h*.075}" fill="#6a9955"># inspect</text>
      <text x="${w*.05}" y="${h*.69}" font-family="monospace" font-size="${h*.075}" fill="#6a9955"># rebuild</text>
      <rect x="${w*.05}" y="${h*.8}" width="${w*.4}" height="${h*.08}" fill="#264f78" rx="1"/>
      <text x="${w*.08}" y="${h*.87}" font-family="monospace" font-size="${h*.065}" fill="#9cdcfe">python 1999</text>
    </svg>`;
  },
  freelance(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#e8e0d0"/>
      <rect x="${w*.1}" y="${h*.08}" width="${w*.8}" height="${h*.55}" rx="2" fill="white" stroke="#c8c0b0" stroke-width="1"/>
      <text x="${w*.5}" y="${h*.22}" font-family="sans-serif" font-size="${h*.085}" fill="#2a2010" text-anchor="middle" font-weight="bold">Invoice</text>
      <line x1="${w*.12}" y1="${h*.27}" x2="${w*.88}" y2="${h*.27}" stroke="#c8c0b0" stroke-width=".5"/>
      <text x="${w*.14}" y="${h*.37}" font-family="sans-serif" font-size="${h*.07}" fill="#5a5040">Website build</text>
      <text x="${w*.86}" y="${h*.37}" font-family="sans-serif" font-size="${h*.07}" fill="#5a5040" text-anchor="end">£350</text>
      <text x="${w*.14}" y="${h*.47}" font-family="sans-serif" font-size="${h*.07}" fill="#5a5040">Hosting setup</text>
      <text x="${w*.86}" y="${h*.47}" font-family="sans-serif" font-size="${h*.07}" fill="#5a5040" text-anchor="end">£80</text>
      <text x="${w*.5}" y="${h*.82}" font-family="sans-serif" font-size="${h*.075}" fill="#8a7a60" text-anchor="middle" font-style="italic">2007—2011</text>
    </svg>`;
  },
  media(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#1a1a1a"/>
      <rect x="${w*.08}" y="${h*.1}" width="${w*.84}" height="${h*.5}" rx="2" fill="#2a2a2a"/>
      <rect x="${w*.1}" y="${h*.12}" width="${w*.8}" height="${h*.46}" fill="#333"/>
      <polygon points="${w*.42},${h*.25} ${w*.58},${h*.35} ${w*.42},${h*.45}" fill="white"/>
      <circle cx="${w*.5}" cy="${h*.35}" r="${w*.12}" fill="none" stroke="white" stroke-width="1.5"/>
      <text x="${w*.5}" y="${h*.75}" font-family="sans-serif" font-size="${h*.075}" fill="#888" text-anchor="middle">VIDEO · SEO · CODE</text>
      <text x="${w*.5}" y="${h*.86}" font-family="sans-serif" font-size="${h*.065}" fill="#555" text-anchor="middle">all at once</text>
    </svg>`;
  },
  bbc(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#e8e0d0"/>
      <image href="assets/images/logos/bbc-logo.svg" x="${w*.2}" y="${h*.15}" width="${w*.6}" height="${h*.45}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.78}" font-family="sans-serif" font-size="${h*.065}" fill="#6a5a40" text-anchor="middle">MediaCity, Salford</text>
      <text x="${w*.5}" y="${h*.88}" font-family="sans-serif" font-size="${h*.065}" fill="#8a7a60" text-anchor="middle">2010 — 2019</text>
    </svg>`;
  },
  award(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#f8f0d8"/>
      <rect x="${w*.08}" y="${h*.06}" width="${w*.84}" height="${h*.88}" rx="3" fill="none" stroke="#c8a840" stroke-width="1.5"/>
      <rect x="${w*.12}" y="${h*.1}" width="${w*.76}" height="${h*.8}" rx="2" fill="none" stroke="#e0c060" stroke-width=".5"/>
      <text x="${w*.5}" y="${h*.22}" font-family="serif" font-size="${h*.075}" fill="#8a6010" text-anchor="middle">AWARD</text>
      <line x1="${w*.2}" y1="${h*.26}" x2="${w*.8}" y2="${h*.26}" stroke="#c8a840" stroke-width=".5"/>
      <image href="assets/images/logos/bbc-logo.svg" x="${w*.3}" y="${h*.3}" width="${w*.4}" height="${h*.2}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.62}" font-family="serif" font-size="${h*.1}" fill="#5a3a08" text-anchor="middle" font-weight="bold">★</text>
      <text x="${w*.5}" y="${h*.76}" font-family="sans-serif" font-size="${h*.065}" fill="#7a5a18" text-anchor="middle">North Star</text>
      <text x="${w*.5}" y="${h*.86}" font-family="sans-serif" font-size="${h*.06}" fill="#8a6a28" text-anchor="middle">Personal Excellence</text>
    </svg>`;
  },
  cannes(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#f8f0d8"/>
      <rect x="${w*.08}" y="${h*.06}" width="${w*.84}" height="${h*.88}" rx="3" fill="none" stroke="#c8a840" stroke-width="1.5"/>
      <rect x="${w*.12}" y="${h*.1}" width="${w*.76}" height="${h*.8}" rx="2" fill="none" stroke="#e0c060" stroke-width=".5"/>
      <text x="${w*.5}" y="${h*.18}" font-family="serif" font-size="${h*.06}" fill="#8a6010" text-anchor="middle">CONTENT INNOVATION</text>
      <line x1="${w*.2}" y1="${h*.22}" x2="${w*.8}" y2="${h*.22}" stroke="#c8a840" stroke-width=".5"/>
      <text x="${w*.5}" y="${h*.34}" font-family="serif" font-size="${h*.06}" fill="#8a6010" text-anchor="middle">CANNES 2018</text>
      <image href="assets/images/logos/bbc-logo.svg" x="${w*.3}" y="${h*.38}" width="${w*.4}" height="${h*.16}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.64}" font-family="serif" font-size="${h*.08}" fill="#5a3a08" text-anchor="middle" font-weight="bold">★</text>
      <text x="${w*.5}" y="${h*.76}" font-family="sans-serif" font-size="${h*.055}" fill="#7a5a18" text-anchor="middle">TV App of the Year</text>
      <text x="${w*.5}" y="${h*.86}" font-family="sans-serif" font-size="${h*.05}" fill="#8a6a28" text-anchor="middle">BBC Sport TV App</text>
    </svg>`;
  },
  redbutton(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#eeeae1"/>
      <rect x="${w*.05}" y="${h*.1}" width="${w*.9}" height="${h*.45}" rx="3" fill="#f7f4ed" stroke="#d6d0c3" stroke-width="1"/>
      <image href="assets/images/logos/bbc-red-button.svg" x="${w*.08}" y="${h*.15}" width="${w*.84}" height="${h*.35}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.72}" font-family="sans-serif" font-size="${h*.065}" fill="#666" text-anchor="middle">Technical Product Manager</text>
      <text x="${w*.5}" y="${h*.84}" font-family="sans-serif" font-size="${h*.06}" fill="#4f4f4f" text-anchor="middle">2014</text>
    </svg>`;
  },
  broadcast(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#0a0a18"/>
      <rect x="${w*.08}" y="${h*.06}" width="${w*.84}" height="${h*.55}" rx="3" fill="#0a0810"/>
      <rect x="${w*.1}" y="${h*.08}" width="${w*.8}" height="${h*.51}" fill="#080812"/>
      <text x="${w*.5}" y="${h*.2}" font-family="monospace" font-size="${h*.065}" fill="#4444aa" text-anchor="middle">LIVE ● BROADCAST</text>
      <rect x="${w*.1}" y="${h*.24}" width="${w*.8}" height="${h*.3}" fill="#0c0c20" rx="1"/>
      <text x="${w*.5}" y="${h*.32}" font-family="monospace" font-size="${h*.055}" fill="#6666cc" text-anchor="middle">Olympics · World Cup</text>
      <text x="${w*.5}" y="${h*.41}" font-family="monospace" font-size="${h*.055}" fill="#6666cc" text-anchor="middle">Wimbledon · Glastonbury</text>
      <text x="${w*.5}" y="${h*.78}" font-family="sans-serif" font-size="${h*.07}" fill="#666" text-anchor="middle">iPlayer · Sport TV</text>
    </svg>`;
  },
  banking(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#6935D3"/>
      <image href="assets/images/logos/starling-logo.svg" x="${w*.2}" y="${h*.08}" width="${w*.6}" height="${h*.35}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.58}" font-family="monospace" font-size="${h*.06}" fill="rgba(255,255,255,0.85)" text-anchor="middle">SEPA INSTANT</text>
      <text x="${w*.5}" y="${h*.68}" font-family="monospace" font-size="${h*.06}" fill="rgba(255,255,255,0.7)" text-anchor="middle">DIRECT DEBIT</text>
      <text x="${w*.5}" y="${h*.78}" font-family="monospace" font-size="${h*.06}" fill="rgba(255,255,255,0.55)" text-anchor="middle">ORIGINATION</text>
      <text x="${w*.5}" y="${h*.92}" font-family="sans-serif" font-size="${h*.06}" fill="rgba(255,255,255,0.4)" text-anchor="middle">BJSS · 2019—2021</text>
    </svg>`;
  },
  covid(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#005eb8"/>
      <image href="assets/images/logos/nhs-covid-app.png" x="${w*.3}" y="${h*.08}" width="${w*.4}" height="${h*.4}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.6}" font-family="sans-serif" font-size="${h*.075}" fill="white" text-anchor="middle" font-weight="bold">TEST &amp; TRACE</text>
      <text x="${w*.5}" y="${h*.73}" font-family="sans-serif" font-size="${h*.06}" fill="rgba(255,255,255,0.8)" text-anchor="middle">national infrastructure</text>
      <text x="${w*.5}" y="${h*.86}" font-family="sans-serif" font-size="${h*.06}" fill="rgba(255,255,255,0.6)" text-anchor="middle">2020 — 2021</text>
    </svg>`;
  },
  nhs(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#005eb8"/>
      <image href="assets/images/logos/nhs-logo.svg" x="${w*.1}" y="${h*.15}" width="${w*.8}" height="${h*.55}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.88}" font-family="sans-serif" font-size="${h*.07}" fill="rgba(255,255,255,0.6)" text-anchor="middle">England</text>
    </svg>`;
  },
  healthtech(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#ffffff"/>
      <image href="assets/images/logos/healthcall-logo.png" x="${w*.08}" y="${h*.12}" width="${w*.84}" height="${h*.45}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.76}" font-family="sans-serif" font-size="${h*.065}" fill="#333" text-anchor="middle">CPTO</text>
      <text x="${w*.5}" y="${h*.87}" font-family="sans-serif" font-size="${h*.06}" fill="#888" text-anchor="middle">2022 — 2024</text>
    </svg>`;
  },
  ai(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#040d04"/>
      <text x="${w*.08}" y="${h*.18}" font-family="monospace" font-size="${h*.075}" fill="#1a8c32">$ python ai_test.py</text>
      <text x="${w*.08}" y="${h*.3}" font-family="monospace" font-size="${h*.065}" fill="#33ff66">Loading model...</text>
      <text x="${w*.08}" y="${h*.41}" font-family="monospace" font-size="${h*.065}" fill="#1a8c32">tokens: 117M</text>
      <text x="${w*.08}" y="${h*.53}" font-family="monospace" font-size="${h*.065}" fill="#33ff66">&gt; "write a poem"</text>
      <text x="${w*.08}" y="${h*.64}" font-family="monospace" font-size="${h*.065}" fill="#1a8c32">In silicon dreams...</text>
      <text x="${w*.08}" y="${h*.78}" font-family="monospace" font-size="${h*.07}" fill="#0a5a18">GPT-2 · 2023</text>
    </svg>`;
  },
  moj(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${w}" height="${h}" fill="#dad6cc"/>
      <rect x="${w*.08}" y="${h*.05}" width="${w*.84}" height="${h*.6}" rx="2" fill="#ece8de" stroke="#c6c0b3" stroke-width="1"/>
      <image href="assets/images/logos/moj-logo.svg" x="${w*.22}" y="${h*.08}" width="${w*.56}" height="${h*.48}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${w*.5}" y="${h*.75}" font-family="monospace" font-size="${h*.055}" fill="#1f7a34" text-anchor="middle">LLM · CHATBOT · DATA</text>
      <text x="${w*.5}" y="${h*.83}" font-family="sans-serif" font-size="${h*.055}" fill="#666" text-anchor="middle">2024</text>
    </svg>`;
  },
  default(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#c8bfac"/>
    </svg>`;
  }
};

function getPlaceholder(key, w, h) {
  const fn = PLACEHOLDERS[key] || PLACEHOLDERS.default;
  return fn.call(PLACEHOLDERS, w, h);
}
