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
    // Geocities-era homepage in Netscape: starfield, rainbow rule, hit counter, the lot.
    const stars = Array.from({ length: 34 }, (_, i) =>
      `<rect x="${(i * 53) % 178 + 5}" y="${(i * 37) % 118 + 30}" width="1.3" height="1.3" fill="#fff" opacity="${0.35 + ((i * 7) % 6) / 10}"/>`).join('');
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="w96-uc" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#111"/><rect x="4" width="4" height="8" fill="#ffd400"/></pattern>
        <linearGradient id="w96-rb" x1="0" x2="1"><stop offset="0" stop-color="#f22"/><stop offset=".2" stop-color="#fe2"/><stop offset=".4" stop-color="#2d2"/><stop offset=".6" stop-color="#2dd"/><stop offset=".8" stop-color="#22f"/><stop offset="1" stop-color="#f2f"/></linearGradient>
      </defs>
      <rect width="190" height="160" fill="#c0c0c0"/>
      <rect width="190" height="12" fill="#000080"/>
      <text x="4" y="8.6" font-family="Arial, sans-serif" font-size="6.4" font-weight="bold" fill="#fff">Netscape - [Matt's Homepage !!]</text>
      <rect x="2" y="14" width="186" height="11" fill="#c0c0c0" stroke="#808080" stroke-width=".6"/>
      <rect x="5" y="16" width="14" height="7" fill="#d4d0c8" stroke="#808080" stroke-width=".5"/>
      <text x="12" y="21.4" font-family="Arial, sans-serif" font-size="4.6" text-anchor="middle" fill="#000">Back</text>
      <rect x="23" y="16" width="160" height="7" fill="#fff" stroke="#808080" stroke-width=".5"/>
      <text x="25" y="21.3" font-family="Arial, sans-serif" font-size="4.7" fill="#000">http://www.geocities.com/SunsetStrip/4719/</text>
      <rect x="2" y="27" width="186" height="131" fill="#0a0a3a"/>
      ${stars}
      <rect x="8" y="31" width="174" height="5" fill="url(#w96-rb)"/>
      <text x="95" y="51" font-family="'Comic Sans MS', 'Chalkboard SE', cursive" font-size="14" font-weight="bold" text-anchor="middle" fill="#ffee00">WELCOME 2</text>
      <text x="95" y="65" font-family="'Comic Sans MS', 'Chalkboard SE', cursive" font-size="14" font-weight="bold" text-anchor="middle" fill="#ff4fd8">MY PAGE!!</text>
      <text x="95" y="76.5" font-family="'Comic Sans MS', 'Chalkboard SE', cursive" font-size="6.4" text-anchor="middle" fill="#33ffff">~*~ Sunset Strip ~*~</text>
      <rect x="24" y="82" width="142" height="11" fill="url(#w96-uc)"/>
      <rect x="46" y="83.2" width="98" height="8.6" fill="#111"/>
      <text x="95" y="89.6" font-family="Arial, sans-serif" font-size="5.6" font-weight="bold" text-anchor="middle" fill="#ffd400">UNDER CONSTRUCTION</text>
      <text x="10" y="106" font-family="Arial, sans-serif" font-size="5.4" fill="#fff">You are visitor no.</text>
      <rect x="10" y="108.5" width="46" height="11" fill="#000" stroke="#8a8a8a" stroke-width=".7"/>
      <text x="33" y="117.2" font-family="'Courier New', monospace" font-size="8.6" font-weight="bold" text-anchor="middle" fill="#30ff50" letter-spacing=".8">000142</text>
      <g transform="rotate(-11 152 112)">
        <rect x="136" y="104" width="32" height="14" fill="#ee1c1c" stroke="#ffee00" stroke-width="1.2"/>
        <text x="152" y="114.4" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#ffee00">NEW!</text>
      </g>
      <text x="10" y="131" font-family="'Comic Sans MS', cursive" font-size="6" fill="#ffa500" text-decoration="underline">Sign my guestbook!!</text>
      <text x="10" y="141" font-family="'Comic Sans MS', cursive" font-size="6" fill="#33ffff" text-decoration="underline">Cool Links</text>
      <text x="95" y="153" font-family="Arial, sans-serif" font-size="4.6" text-anchor="middle" fill="#9aa0b4">Best viewed in Netscape 3.0 at 800x600</text>
    </svg>`;
  },
  mirc(w, h) {
    // mIRC on Windows 98: channel, nick list, a very 1998 conversation.
    const line = (y, nickCol, nick, text) =>
      `<text x="6" y="${y}" font-family="'Courier New', monospace" font-size="5.4"><tspan fill="${nickCol}">${nick}</tspan><tspan fill="#000"> ${text}</tspan></text>`;
    const info = (y, col, text) =>
      `<text x="6" y="${y}" font-family="'Courier New', monospace" font-size="5.4" fill="${col}">${text}</text>`;
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="190" height="160" fill="#c0c0c0"/>
      <rect width="190" height="12" fill="#000080"/>
      <text x="4" y="8.6" font-family="Arial, sans-serif" font-size="6.4" font-weight="bold" fill="#fff">mIRC - [#chat: 38 users]</text>
      <rect x="176" y="2.5" width="9" height="7" fill="#c0c0c0" stroke="#fff" stroke-width=".6"/>
      <text x="4" y="19.6" font-family="Arial, sans-serif" font-size="5.2" fill="#000">File  View  Tools  Commands  Window  Help</text>
      <rect x="3" y="23" width="184" height="9" fill="#fff" stroke="#808080" stroke-width=".6"/>
      <text x="5" y="29.4" font-family="Arial, sans-serif" font-size="4.8" fill="#000080">Topic: games, linux, a/s/l and general mayhem</text>
      <rect x="3" y="33" width="136" height="106" fill="#fff" stroke="#808080" stroke-width=".7"/>
      <rect x="141" y="33" width="46" height="106" fill="#fff" stroke="#808080" stroke-width=".7"/>
      ${info(41, '#009300', '* Now talking in #chat')}
      ${line(52, '#009393', '&lt;m4tt&gt;', 'how do i compile')}
      ${line(60, '#009393', '&lt;m4tt&gt;', 'this thing??')}
      ${line(71, '#7f0000', '&lt;root&gt;', 'gcc -o a a.c')}
      ${line(82, '#009393', '&lt;m4tt&gt;', 'OMG IT WORKS')}
      ${info(93, '#009300', '* n00b has joined #chat')}
      ${line(104, '#9c009c', '&lt;xX_zer0_Xx&gt;', 'a/s/l?')}
      ${info(115, '#7f7f7f', '* m4tt is away (homework)')}
      ${info(126, '#fc7f00', '* Ping reply: 2.3 secs')}
      <g font-family="'Courier New', monospace" font-size="5.2" fill="#000">
        <text x="144" y="41">@root</text><text x="144" y="49">@dave</text><text x="144" y="57">+n00b</text><text x="144" y="65">m4tt</text>
        <text x="144" y="73">xX_zer0_Xx</text><text x="144" y="81">Cyb3rGrl</text><text x="144" y="89">dr_who</text>
      </g>
      <rect x="3" y="142" width="184" height="10" fill="#fff" stroke="#808080" stroke-width=".7"/>
      <text x="6" y="149.2" font-family="'Courier New', monospace" font-size="5.4" fill="#000">/join #linux</text>
      <rect x="45" y="144.4" width="3" height="5.4" fill="#000"/>
      <text x="4" y="158" font-family="Arial, sans-serif" font-size="4.2" fill="#444">mIRC 5.91</text>
    </svg>`;
  },
  code(w, h) {
    // A DOS IDE with a Python prompt open beside it: the build / break / inspect / rebuild loop.
    const l = (y, t, c = '#fff') => `<text x="9" y="${y}" font-family="'Courier New', monospace" font-size="5.6" fill="${c}" xml:space="preserve">${t}</text>`;
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="190" height="160" fill="#0000aa"/>
      <rect width="190" height="10" fill="#aaaaaa"/>
      <text x="4" y="7.2" font-family="'Courier New', monospace" font-size="5.4" fill="#000"><tspan fill="#aa0000">F</tspan>ile  <tspan fill="#aa0000">E</tspan>dit  <tspan fill="#aa0000">S</tspan>earch  <tspan fill="#aa0000">R</tspan>un  <tspan fill="#aa0000">C</tspan>ompile</text>
      <rect x="4" y="14" width="182" height="126" fill="none" stroke="#55ffff" stroke-width="1"/>
      <rect x="7" y="17" width="176" height="120" fill="none" stroke="#55ffff" stroke-width=".5"/>
      <rect x="74" y="11.5" width="42" height="6" fill="#0000aa"/>
      <text x="95" y="16.6" font-family="'Courier New', monospace" font-size="5.4" text-anchor="middle" fill="#fff">HELLO.C</text>
      ${l(28, '#include &lt;stdio.h&gt;', '#55ffff')}
      ${l(37, 'main()', '#ffff55')}
      ${l(46, '{')}
      ${l(55, '  int i;', '#ffff55')}
      ${l(64, '  for(i=0;i&lt;10;i++)', '#ffff55')}
      ${l(73, '    printf("hello\\n");', '#55ff55')}
      ${l(82, '}')}
      <rect x="103" y="90" width="76" height="43" fill="#000" stroke="#aaaaaa" stroke-width=".8"/>
      <rect x="103" y="90" width="76" height="7" fill="#aaaaaa"/>
      <text x="141" y="95.3" font-family="'Courier New', monospace" font-size="4.8" text-anchor="middle" fill="#000">Python 1.5.2</text>
      <g font-family="'Courier New', monospace" font-size="5.4" fill="#d8d8d8">
        <text x="107" y="106">&gt;&gt;&gt; print 'hello'</text>
        <text x="107" y="115">hello</text>
        <text x="107" y="124">&gt;&gt;&gt; </text>
      </g>
      <rect x="123" y="120.6" width="3" height="5" fill="#d8d8d8"/>
      <rect y="143" width="190" height="17" fill="#aaaaaa"/>
      <text x="95" y="151" font-family="'Courier New', monospace" font-size="5.4" text-anchor="middle" fill="#000">F9 Make   F10 Menu</text>
      <text x="95" y="157.4" font-family="'Courier New', monospace" font-size="5.4" font-weight="bold" text-anchor="middle" fill="#aa0000">build &gt; break &gt; inspect &gt; rebuild</text>
    </svg>`;
  },
  freelance(w, h) {
    // A freelancer's desk: invoice, sticky notes, coffee ring.
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="fl-desk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c29a"/><stop offset="1" stop-color="#c3a77a"/></linearGradient></defs>
      <rect width="190" height="160" fill="url(#fl-desk)"/>
      <g stroke="rgba(90,55,20,.12)" stroke-width=".8"><path d="M0 22H190M0 50H190M0 84H190M0 118H190M0 146H190"/></g>
      <circle cx="30" cy="132" r="14" fill="none" stroke="rgba(92,52,20,.35)" stroke-width="2.2"/>
      <circle cx="30" cy="132" r="13" fill="none" stroke="rgba(92,52,20,.14)" stroke-width="1"/>
      <g transform="rotate(-4 78 80)">
        <rect x="26" y="12" width="104" height="124" fill="#00000022" transform="translate(2 3)"/>
        <rect x="26" y="12" width="104" height="124" fill="#fffef9" stroke="#d6cfbf" stroke-width=".8"/>
        <text x="36" y="28" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#2a2418">INVOICE</text>
        <text x="122" y="28" font-family="Arial, sans-serif" font-size="6" text-anchor="end" fill="#8a7e66">no. 007</text>
        <line x1="34" y1="34" x2="122" y2="34" stroke="#d6cfbf" stroke-width=".7"/>
        <g font-family="Arial, sans-serif" font-size="6.6" fill="#4a4232">
          <text x="36" y="48">Website build</text><text x="122" y="48" text-anchor="end">&#163;350</text>
          <text x="36" y="60">Hosting setup</text><text x="122" y="60" text-anchor="end">&#163;80</text>
          <text x="36" y="72">Logo (bigger)</text><text x="122" y="72" text-anchor="end">&#163;40</text>
        </g>
        <line x1="34" y1="79" x2="122" y2="79" stroke="#4a4232" stroke-width=".7"/>
        <text x="36" y="91" font-family="Arial, sans-serif" font-size="7.4" font-weight="bold" fill="#2a2418">TOTAL</text>
        <text x="122" y="91" font-family="Arial, sans-serif" font-size="7.4" font-weight="bold" text-anchor="end" fill="#2a2418">&#163;470</text>
        <g transform="rotate(-14 78 112)">
          <rect x="44" y="100" width="68" height="20" rx="2" fill="none" stroke="#c0392b" stroke-width="1.8" opacity=".85"/>
          <text x="78" y="115" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#c0392b" opacity=".85">OVERDUE</text>
        </g>
      </g>
      <g transform="rotate(7 160 44)">
        <rect x="132" y="18" width="52" height="50" fill="#ffe66d" stroke="#e0c84a" stroke-width=".6"/>
        <g font-family="'Comic Sans MS', 'Chalkboard SE', cursive" font-size="6.3" fill="#3b3320">
          <text x="137" y="30">client says:</text><text x="137" y="40">"can u make</text><text x="137" y="50">the logo</text><text x="137" y="60" font-weight="bold">BIGGER?"</text>
        </g>
      </g>
      <g transform="rotate(-6 158 112)">
        <rect x="134" y="88" width="48" height="44" fill="#ff9ec7" stroke="#e57aa8" stroke-width=".6"/>
        <g font-family="'Comic Sans MS', 'Chalkboard SE', cursive" font-size="6.3" fill="#4a1630">
          <text x="139" y="101">chase</text><text x="139" y="111">invoice</text><text x="139" y="121" font-weight="bold">AGAIN!!</text>
        </g>
      </g>
      <text x="95" y="153" font-family="Georgia, serif" font-size="6.4" font-style="italic" text-anchor="middle" fill="#6b5738">self-employed, 2007 &#8212; 2011</text>
    </svg>`;
  },
  media(w, h) {
    // An edit suite at silly o'clock: video timeline, search rankings, code, and a very tired clock.
    const clip = (x, y, wd, c) => `<rect x="${x}" y="${y}" width="${wd}" height="8" rx="1" fill="${c}"/>`;
    const wave = Array.from({ length: 36 }, (_, i) => {
      const a = 1.2 + Math.abs(Math.sin(i * 1.7) * 2.6) + (i % 5 === 0 ? 1 : 0);
      return `<rect x="${10 + i * 2.4}" y="${112 - a}" width="1.3" height="${a * 2}" fill="#3ddc84"/>`;
    }).join('');
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="md-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a3d"/><stop offset=".55" stop-color="#d13a6a"/><stop offset="1" stop-color="#3a2a7a"/></linearGradient></defs>
      <rect width="190" height="160" fill="#18181c"/>
      <rect x="8" y="8" width="104" height="58" rx="2" fill="url(#md-frame)" stroke="#44444c" stroke-width="1"/>
      <polygon points="52,26 52,48 72,37" fill="rgba(255,255,255,.92)"/>
      <rect x="8" y="56" width="104" height="10" fill="rgba(0,0,0,.55)"/>
      <text x="12" y="63.4" font-family="'Courier New', monospace" font-size="5.8" fill="#3dff7a">00:01:12:07</text>
      <text x="108" y="63.4" font-family="'Courier New', monospace" font-size="5.2" text-anchor="end" fill="#ff5a4d">&#9679; REC</text>
      <rect x="118" y="8" width="64" height="31" rx="2" fill="#fff"/>
      <text x="122" y="17" font-family="Arial, sans-serif" font-size="5.2" fill="#1a0dab" text-decoration="underline">Snap Media: top picks</text>
      <rect x="122" y="21" width="52" height="2.2" fill="#b8bcc4"/><rect x="122" y="26" width="56" height="2.2" fill="#d0d3d9"/><rect x="122" y="31" width="40" height="2.2" fill="#d0d3d9"/>
      <circle cx="173" cy="30" r="6.6" fill="#1ea446"/><text x="173" y="32.8" font-family="Arial, sans-serif" font-size="8" font-weight="bold" text-anchor="middle" fill="#fff">1</text>
      <rect x="118" y="43" width="64" height="23" rx="2" fill="#0d0d10" stroke="#34343c" stroke-width=".7"/>
      <g font-family="'Courier New', monospace" font-size="5.2"><text x="122" y="52" fill="#ff6b9d">&lt;title&gt;<tspan fill="#9cdcfe">Top 10!</tspan></text><text x="122" y="60" fill="#c3e88d">&lt;meta keywords&gt;</text></g>
      <rect x="8" y="72" width="174" height="56" rx="2" fill="#101013" stroke="#34343c" stroke-width=".7"/>
      <g font-family="Arial, sans-serif" font-size="4.6" fill="#7a7a86"><text x="11" y="82">V2</text><text x="11" y="94">V1</text><text x="11" y="116">A1</text></g>
      ${clip(22, 77, 38, '#8e5cff')}${clip(64, 77, 28, '#8e5cff')}${clip(98, 77, 44, '#8e5cff')}
      ${clip(22, 89, 52, '#3b82f6')}${clip(78, 89, 30, '#3b82f6')}${clip(112, 89, 56, '#3b82f6')}
      <g transform="translate(14 0)">${wave}</g>
      <line x1="104" y1="73" x2="104" y2="127" stroke="#ff3b30" stroke-width="1"/>
      <polygon points="101,73 107,73 104,78" fill="#ff3b30"/>
      <rect x="8" y="134" width="64" height="20" rx="2" fill="#050505" stroke="#34343c" stroke-width=".8"/>
      <text x="40" y="149.4" font-family="'Courier New', monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="#ff3b30" letter-spacing=".5">02:47</text>
      <text x="80" y="143" font-family="Georgia, serif" font-size="6.6" font-style="italic" fill="#8c8c98">still editing.</text>
      <text x="80" y="152" font-family="Georgia, serif" font-size="6.6" font-style="italic" fill="#5f5f6a">18 hours in.</text>
    </svg>`;
  },
  bbc(w, h) {
    // The pass that got him through the door.
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bb-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece5d6"/><stop offset="1" stop-color="#d9cfba"/></linearGradient></defs>
      <rect width="190" height="160" fill="url(#bb-bg)"/>
      <path d="M86 0 L82 30 H108 L104 0 Z" fill="#1f1f1f"/>
      <path d="M86 0 L84.4 14 H105.6 L104 0 Z" fill="#2b2b2b"/>
      <g font-family="Arial, sans-serif" font-size="4.4" font-weight="bold" fill="#fff" opacity=".7"><text x="95" y="9" text-anchor="middle">BBC</text><text x="95" y="21" text-anchor="middle">BBC</text></g>
      <rect x="88" y="28" width="14" height="6" rx="2" fill="#9a9a9a"/>
      <g transform="rotate(-4 95 92)">
        <rect x="42" y="38" width="108" height="116" rx="7" fill="#00000026" transform="translate(2 3)"/>
        <rect x="42" y="38" width="108" height="116" rx="7" fill="#fff" stroke="#c8c4ba" stroke-width="1"/>
        <rect x="82" y="42" width="28" height="5" rx="2.5" fill="#d7d3c8"/>
        <image href="assets/images/logos/bbc-logo.svg" x="60" y="52" width="72" height="22" preserveAspectRatio="xMidYMid meet"/>
        <rect x="60" y="80" width="30" height="38" fill="#e3e0d8" stroke="#c8c4ba" stroke-width=".8"/>
        <circle cx="75" cy="94" r="7" fill="#b9b4a6"/><path d="M62 118 C62 104 88 104 88 118 Z" fill="#b9b4a6"/>
        <text x="96" y="90" font-family="Arial, sans-serif" font-size="8.4" font-weight="bold" fill="#111">MATT</text>
        <text x="96" y="100" font-family="Arial, sans-serif" font-size="8.4" font-weight="bold" fill="#111">VISSER</text>
        <text x="96" y="111" font-family="Arial, sans-serif" font-size="4.8" fill="#555">CONTENT &amp; PRODUCTION</text>
        <text x="96" y="118" font-family="Arial, sans-serif" font-size="4.8" fill="#555">MEDIACITY, SALFORD</text>
        <g fill="#111">${Array.from({ length: 26 }, (_, i) => `<rect x="${60 + i * 2.7}" y="130" width="${i % 3 === 0 ? 1.8 : 1}" height="14"/>`).join('')}</g>
        <g transform="rotate(32 140 52)"><rect x="112" y="46" width="60" height="12" fill="#e5b400" stroke="#9a7a00" stroke-width=".6"/>
        <text x="142" y="55" font-family="Arial, sans-serif" font-size="6.6" font-weight="bold" text-anchor="middle" fill="#3a2a00">WINNER!</text></g>
      </g>
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
  nhsapp(w, h) {
    // The NHS App, September 2026: an illustration of the at-home test flow, not a real screen.
    return `<svg viewBox="0 0 190 160" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="na-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a6bc9"/><stop offset="1" stop-color="#003087"/></linearGradient></defs>
      <rect width="190" height="160" fill="url(#na-bg)"/>
      <rect x="55" y="9" width="80" height="162" rx="11" fill="#0b1a33"/>
      <rect x="58" y="12" width="74" height="156" rx="9" fill="#f0f4f5"/>
      <rect x="82" y="15" width="26" height="4" rx="2" fill="#0b1a33"/>
      <rect x="58" y="22" width="74" height="22" fill="#005eb8"/>
      <image href="assets/images/logos/nhs-logo.svg" x="63" y="26" width="30" height="12" preserveAspectRatio="xMinYMid meet"/>
      <text x="126" y="35" font-family="Arial, sans-serif" font-size="5.4" font-weight="bold" text-anchor="end" fill="#fff">App</text>
      <text x="65" y="55" font-family="Arial, sans-serif" font-size="6.6" font-weight="bold" fill="#212b32">Order a test</text>
      <g>
        <rect x="64" y="60" width="62" height="21" rx="3" fill="#fff" stroke="#d8dde0" stroke-width=".8"/>
        <circle cx="73" cy="70.5" r="4.2" fill="#e8edee"/>
        <text x="81" y="69" font-family="Arial, sans-serif" font-size="5.2" font-weight="bold" fill="#212b32">Blood pressure</text>
        <text x="81" y="76" font-family="Arial, sans-serif" font-size="4.4" fill="#4c6272">Home check</text>
        <rect x="64" y="85" width="62" height="25" rx="3" fill="#fff" stroke="#007f3b" stroke-width="1.6"/>
        <circle cx="73" cy="97.5" r="4.6" fill="#d5281b"/>
        <path d="M73 94.2 C75.2 97 76 98.2 76 99.4 A3 3 0 0 1 70 99.4 C70 98.2 70.8 97 73 94.2 Z" fill="#fff"/>
        <text x="81" y="95.5" font-family="Arial, sans-serif" font-size="5.6" font-weight="bold" fill="#212b32">HIV test</text>
        <text x="81" y="102.4" font-family="Arial, sans-serif" font-size="4.4" fill="#4c6272">Free home kit</text>
        <rect x="104" y="87.5" width="19" height="7" rx="3.5" fill="#007f3b"/>
        <text x="113.5" y="92.6" font-family="Arial, sans-serif" font-size="4.6" font-weight="bold" text-anchor="middle" fill="#fff">NEW</text>
        <rect x="64" y="114" width="62" height="21" rx="3" fill="#fff" stroke="#d8dde0" stroke-width=".8"/>
        <circle cx="73" cy="124.5" r="4.2" fill="#e8edee"/>
        <text x="81" y="123" font-family="Arial, sans-serif" font-size="5.2" font-weight="bold" fill="#212b32">Your results</text>
        <text x="81" y="130" font-family="Arial, sans-serif" font-size="4.4" fill="#4c6272">In the app</text>
      </g>
      <g fill="#c4ccd0"><circle cx="76" cy="152" r="3"/><circle cx="95" cy="152" r="3" fill="#005eb8"/><circle cx="114" cy="152" r="3"/></g>
      <text x="26" y="82" font-family="Georgia, serif" font-size="8" font-style="italic" text-anchor="middle" fill="rgba(255,255,255,.9)">Sept</text>
      <text x="26" y="93" font-family="Georgia, serif" font-size="8" font-style="italic" text-anchor="middle" fill="rgba(255,255,255,.9)">2026</text>
      <text x="164" y="82" font-family="Georgia, serif" font-size="7" font-style="italic" text-anchor="middle" fill="rgba(255,255,255,.7)">first on</text>
      <text x="164" y="92" font-family="Georgia, serif" font-size="7" font-style="italic" text-anchor="middle" fill="rgba(255,255,255,.7)">the app</text>
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
