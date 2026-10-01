/* Cookie and Privacy Policy. Plain HTML held as data so Help, Settings and the consent banner all show the same text.
   The wording tracks what the code really does (see js/consent.js). If the code changes, change this and bump POLICY_DATE. */
(function () {
  'use strict';
  const PC = window.PC;
  PC.POLICY_DATE = '1 October 2026';
  PC.POLICY_CONTACT = 'https://github.com/visser23/visser23.github.io/issues';
  PC.policyHtml = () => `
<p class="muted">Last updated ${PC.POLICY_DATE}. This policy covers the Pitchcraft web app at <b>visser23.github.io/pitchcraft</b> (the "Service"). It is written to meet the UK GDPR, the Data Protection Act 2018, the Privacy and Electronic Communications Regulations (PECR) and the EU GDPR.</p>

<h3>The short version</h3>
<ul>
  <li><b>Your decks never leave your device.</b> Pitchcraft has no accounts, no server-side storage and no database. Decks, images and settings are kept in your browser only.</li>
  <li><b>Analytics are off until you say yes.</b> If you accept, Google Analytics sets two cookies and sends anonymous usage data to Google. If you decline, nothing is loaded or sent.</li>
  <li>You can change your mind at any time in <b>Settings &rarr; Privacy</b>.</li>
</ul>

<h3>1. Who is responsible</h3>
<p>The Service is operated by <b>Matt Visser</b> as an individual (the "operator", "we"), who is the data controller for the analytics described below. To ask a question or exercise a right, open an issue at <a href="${PC.POLICY_CONTACT}" target="_blank" rel="noopener noreferrer">${PC.POLICY_CONTACT.replace('https://', '')}</a> (please do not include personal information in a public issue; say you would like a private reply and we will arrange one).</p>

<h3>2. What is stored on your device</h3>
<p>The Service uses your browser's local storage to work. These items are <b>strictly necessary</b> or were requested by you (saving your deck, remembering a setting you chose), so under PECR they do not need consent. They never leave your device.</p>
<table class="pol-t"><thead><tr><th>Name</th><th>What it holds</th><th>Lasts</th></tr></thead><tbody>
<tr><td><code>pitchcraft.deck.v3</code></td><td>Your current deck, including any pictures you added (autosave)</td><td>Until you clear it</td></tr>
<tr><td><code>pitchcraft.backups.v1</code></td><td>A few recovery copies of earlier versions of your deck</td><td>Until you clear it</td></tr>
<tr><td><code>pitchcraft.ui</code></td><td>Your light or dark mode choice</td><td>Until you clear it</td></tr>
<tr><td><code>pitchcraft.consent</code></td><td>Your answer to the cookie banner and when you gave it</td><td>Until you clear it or change your answer</td></tr>
<tr><td><code>pitchcraft.localfonts</code></td><td>A flag saying you allowed the font list from your computer (the list itself is never stored)</td><td>Until you clear it</td></tr>
</tbody></table>

<h3>3. Analytics cookies (only with your consent)</h3>
<p>If you choose <b>Accept analytics</b>, we load Google Analytics 4 (measurement ID <code>G-EF7CY6HHYP</code>) from Google's servers. It sets:</p>
<table class="pol-t"><thead><tr><th>Cookie</th><th>Purpose</th><th>Lasts</th></tr></thead><tbody>
<tr><td><code>_ga</code></td><td>Distinguishes one browser from another so visits can be counted</td><td>2 years</td></tr>
<tr><td><code>_ga_G-EF7CY6HHYP</code></td><td>Keeps track of the current session</td><td>2 years</td></tr>
</tbody></table>
<p>What Google receives: pages viewed, approximate location (derived from your IP address, which Google does not store in full for Analytics 4), browser, device and operating system type, language, the page you came from, and how long you stayed. We have turned off Google signals and advertising personalisation, and we do not link analytics to your identity. <b>We never send the contents of your decks, your pictures or the text you type.</b></p>
<p><b>Why we do this:</b> to understand which features people use so we can improve them. <b>Legal basis:</b> your consent (Article 6(1)(a) UK/EU GDPR; regulation 6 PECR). Declining has no effect on the Service.</p>
<p><b>Changing your mind:</b> open Settings &rarr; Privacy and switch analytics off. We then stop loading Google's script and delete the cookies listed above. You can also clear cookies in your browser at any time.</p>

<h3>4. Other parties who see your data</h3>
<ul>
  <li><b>GitHub, Inc.</b> hosts the Service on GitHub Pages. Like any web host it processes your IP address and browser details in its server logs to deliver the site. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub's privacy statement</a>.</li>
  <li><b>Google LLC</b> receives analytics data only if you accept (section 3). Google may process data in the United States and other countries; transfers rely on the UK-US data bridge / EU-US Data Privacy Framework or standard contractual clauses. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's privacy policy</a>.</li>
  <li><b>Pictures and links in your deck.</b> If you point a slide at a picture on another website, your browser requests it from that site, which then sees your IP address. Pictures you upload are embedded in your deck and not sent anywhere.</li>
  <li>Fonts are bundled with the Service. We do not use Google Fonts or any other font host. If you let Pitchcraft list the fonts installed on your computer, that list stays in the page and is not uploaded.</li>
</ul>
<p>We do not sell personal data, use it for advertising, or run any other trackers.</p>

<h3>5. AI features</h3>
<p>Pitchcraft does not call any AI service itself. The "Build with AI" button gives you a prompt to copy into an AI assistant of your choice, and a deck you paste back is read locally. What you share with that assistant is governed by that provider's terms, not this policy.</p>

<h3>6. How long we keep data</h3>
<p>Items in your browser stay until you delete them (Deck &rarr; New deck, Settings, or your browser's "clear site data"). Google Analytics data is kept for the retention period set on the analytics property, which we keep at 14 months or less. Server logs held by GitHub follow GitHub's own retention.</p>

<h3>7. Your rights</h3>
<p>You have the right to access, correct, erase or restrict use of your personal data, to object to processing, to data portability, and to withdraw consent at any time without affecting earlier processing. Because we cannot identify you from analytics data, we may need the cookie value (the number after <code>GA1.1.</code> in your <code>_ga</code> cookie) to find it. You can also complain to the UK Information Commissioner's Office (<a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">ico.org.uk</a>) or to your local data protection authority.</p>

<h3>8. Children</h3>
<p>The Service is a general-purpose tool and is not aimed at children under 13 (or under 16 where local law requires). We do not knowingly collect personal data from children.</p>

<h3>9. Security</h3>
<p>The Service is served over HTTPS. Slides containing custom code run in a sandbox that cannot reach your other data or the network, and pasted decks are cleaned before use. No system is perfectly secure, so keep your own backups of important decks (Export &rarr; JSON).</p>

<h3>10. Changes</h3>
<p>If this policy changes in a way that matters, we update the date above and, where the change affects cookies, ask for your consent again.</p>`;

  PC.policyDialog = function () {
    const UI = PC.ui;
    UI.modal({ title: 'Cookie and privacy policy', size: 'mid', body: `<div class="policy">${PC.policyHtml()}</div>`, footer: '<button class="btn primary" type="button" data-close>Close</button>' });
  };
})();
