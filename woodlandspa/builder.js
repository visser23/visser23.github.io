document.addEventListener('DOMContentLoaded', () => {

  const PRICING = {
    thermal:       { midweek: 120, 'weekend-fs': 150, 'weekend-sat': 160 },
    'thermal-dine':{ midweek: 152, 'weekend-fs': 182, 'weekend-sat': 192 },
    twilight:      { midweek: 85,  'weekend-fs': 90,  'weekend-sat': 95  },
    bb:            { midweek: 200, 'weekend-fs': 240, 'weekend-sat': 275 },
    dbb:           { midweek: 240, 'weekend-fs': 280, 'weekend-sat': 315 },
    sparkling:     { midweek: 175, 'weekend-fs': 175, 'weekend-sat': 175 }
  };

  const VISIT_LABELS = {
    thermal: 'Thermal Experience',
    'thermal-dine': 'Thermal & Dine',
    twilight: 'Twilight Experience',
    bb: 'Spa Break – B&B',
    dbb: 'Spa Break – Dinner, B&B',
    sparkling: 'English Sparkling Retreat'
  };

  const RASUL_PRICING = { 2: 58, 3: 69, 4: 80 };

  const TREATMENTS = [
    { id: 'tgu', name: 'The Total Glow Up', cat: 'signature', mins: 90, price: 148 },
    { id: 'pe',  name: 'Paradise Escape', cat: 'signature', mins: 105, price: 168 },
    { id: 'ct',  name: 'Champagne & Truffles Facial', cat: 'facials', mins: 75, price: 117 },
    { id: 'cr',  name: 'Crystal Retinal Facial', cat: 'facials', mins: 75, price: 117 },
    { id: 'ef',  name: 'Medik8 Expert Facial', cat: 'facials', mins: 60, price: 104 },
    { id: 'mks', name: 'My Kinda Skin Facial', cat: 'facials', mins: 60, price: 104 },
    { id: 'ssf', name: 'Skin Smoothie Facial', cat: 'facials', mins: 30, price: 62  },
    { id: 'nmb', name: 'NEOM Mood Boost', cat: 'massage', mins: 75, price: 117 },
    { id: 'nsl', name: 'NEOM Sleep', cat: 'massage', mins: 75, price: 117 },
    { id: 'nds', name: 'NEOM De-Stress', cat: 'massage', mins: 75, price: 117 },
    { id: 'end', name: 'Express NEOM De-Stress', cat: 'massage', mins: 45, price: 69  },
    { id: 'fg',  name: 'Feeling Good Aromatherapy', cat: 'massage', mins: 60, price: 104 },
    { id: 'da',  name: 'Drift Away Massage', cat: 'massage', mins: 60, price: 104 },
    { id: 'wio', name: 'Work It Out Deep Tissue', cat: 'massage', mins: 60, price: 104 },
    { id: 'bam', name: 'Bamboo Massage', cat: 'massage', mins: 60, price: 104 },
    { id: 'hs',  name: 'Hot Stone Massage', cat: 'massage', mins: 60, price: 104 },
    { id: 'bm',  name: 'Back Massage', cat: 'massage', mins: 30, price: 62  },
    { id: 'thm', name: 'Tranquillity Head Massage', cat: 'massage', mins: 30, price: 62  },
    { id: 'lfe', name: 'Leg & Foot Energiser', cat: 'massage', mins: 30, price: 62  },
    { id: 'rbs', name: 'NEOM Body Scrub', cat: 'body', mins: 75, price: 117 },
    { id: 'gte', name: 'Golden Truffle Experience', cat: 'body', mins: 60, price: 104 },
    { id: 'btl', name: 'Back To Life', cat: 'body', mins: 45, price: 69  },
    { id: 'rbr', name: 'Reviving Back Ritual', cat: 'body', mins: 45, price: 69  },
    { id: 'lm',  name: 'Luxury Manicure/Pedicure', cat: 'nails', mins: 60, price: 60  },
    { id: 'gc',  name: 'OPI Gel Colour', cat: 'nails', mins: 30, price: 45  },
    { id: 'mgc', name: 'Mani/Pedi with Gel Colour', cat: 'nails', mins: 60, price: 60  }
  ];

  // Discount tiers: items >= threshold → discount %
  // 1 item = 0%, 2 items = 5%, 3+ items = 10%, 5+ items = 15%
  function getDiscountTier(itemCount) {
    if (itemCount >= 5) return { pct: 15, label: '15% package saving' };
    if (itemCount >= 3) return { pct: 10, label: '10% package saving' };
    if (itemCount >= 2) return { pct: 5,  label: '5% package saving' };
    return { pct: 0, label: '' };
  }

  // State
  const state = {
    visitType: null,
    dayType: 'midweek',
    guests: 2,
    treatments: [],  // array of treatment ids
    rasul: false,
    departureSpa: false,
    lunchVenue: '',
    dinnerVenue: '',
    step: 1
  };

  // Elements
  const panels = document.querySelectorAll('.builder-panel');
  const indicators = document.querySelectorAll('.builder-step-indicator');
  const visitCards = document.querySelectorAll('.visit-type-card');
  const daySelect = document.getElementById('visitDay');
  const guestCount = document.getElementById('guestCount');
  const basketItems = document.getElementById('basketItems');
  const basketTotal = document.getElementById('basketTotal');
  const basketSaving = document.getElementById('basketSaving');
  const savingAmount = document.getElementById('savingAmount');
  const treatmentsContainer = document.getElementById('builderTreatments');
  const dinnerGroup = document.getElementById('dinnerGroup');
  const departureSpaCheck = document.getElementById('departureSpa');
  const departureLabel = document.getElementById('departureLabel');

  function isOvernight() {
    return ['bb', 'dbb', 'sparkling'].includes(state.visitType);
  }

  // Visit type selection
  visitCards.forEach(card => {
    card.addEventListener('click', () => {
      visitCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.visitType = card.dataset.visit;
      document.getElementById('toStep2').disabled = false;
      updateBasket();
    });
  });

  daySelect.addEventListener('change', () => {
    state.dayType = daySelect.value;
    updateBasket();
  });

  // Guest counter
  document.getElementById('guestMinus').addEventListener('click', () => {
    if (state.guests > 1) { state.guests--; guestCount.textContent = state.guests; updateBasket(); }
  });
  document.getElementById('guestPlus').addEventListener('click', () => {
    if (state.guests < 8) { state.guests++; guestCount.textContent = state.guests; updateBasket(); }
  });

  // Navigation
  function goToStep(n) {
    state.step = n;
    panels.forEach(p => p.classList.toggle('active', +p.dataset.panel === n));
    indicators.forEach(ind => {
      const s = +ind.dataset.step;
      ind.classList.toggle('active', s === n);
      ind.classList.toggle('complete', s < n);
    });

    if (n === 3) renderTreatments();
    if (n === 4) {
      const overnight = isOvernight();
      dinnerGroup.style.display = overnight ? 'block' : 'none';
      departureSpaCheck.style.display = overnight ? 'inline' : 'none';
      departureLabel.style.display = overnight ? 'inline' : 'none';
    }
    if (n === 5) renderReview();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('toStep2').addEventListener('click', () => goToStep(2));
  document.getElementById('toStep3').addEventListener('click', () => goToStep(3));
  document.getElementById('toStep4').addEventListener('click', () => goToStep(4));
  document.getElementById('toStep5').addEventListener('click', () => goToStep(5));
  document.getElementById('backTo1').addEventListener('click', () => goToStep(1));
  document.getElementById('backTo2').addEventListener('click', () => goToStep(2));
  document.getElementById('backTo3').addEventListener('click', () => goToStep(3));
  document.getElementById('backTo4').addEventListener('click', () => goToStep(4));

  // Treatments rendering
  function renderTreatments() {
    treatmentsContainer.innerHTML = '';
    TREATMENTS.forEach(t => {
      const isAdded = state.treatments.includes(t.id);
      const item = document.createElement('div');
      item.className = 'treatment-item';
      item.dataset.bcat = t.cat;
      item.innerHTML = `
        <div>
          <div class="treatment-name">${t.name}</div>
          <div class="treatment-desc">${t.mins} minutes</div>
        </div>
        <div class="treatment-meta">
          <div class="treatment-price">&pound;${t.price}</div>
          <button class="treatment-add ${isAdded ? 'added' : ''}" data-tid="${t.id}">
            ${isAdded ? 'Added' : 'Add +'}
          </button>
        </div>
      `;
      treatmentsContainer.appendChild(item);
    });

    treatmentsContainer.querySelectorAll('.treatment-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        const idx = state.treatments.indexOf(tid);
        if (idx > -1) {
          state.treatments.splice(idx, 1);
          btn.classList.remove('added');
          btn.textContent = 'Add +';
        } else {
          state.treatments.push(tid);
          btn.classList.add('added');
          btn.textContent = 'Added';
        }
        updateBasket();
      });
    });
  }

  // Builder treatment filters
  document.querySelectorAll('[data-bfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-bfilter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.bfilter;
      treatmentsContainer.querySelectorAll('.treatment-item').forEach(item => {
        item.style.display = (f === 'all' || item.dataset.bcat === f) ? '' : 'none';
      });
    });
  });

  // Extras
  document.getElementById('rasulExtra').addEventListener('change', (e) => {
    state.rasul = e.target.checked;
    updateBasket();
  });
  departureSpaCheck.addEventListener('change', (e) => {
    state.departureSpa = e.target.checked;
    updateBasket();
  });

  document.getElementById('lunchVenue').addEventListener('change', (e) => {
    state.lunchVenue = e.target.value;
  });
  document.getElementById('dinnerVenue').addEventListener('change', (e) => {
    state.dinnerVenue = e.target.value;
  });

  // Calculate & update basket
  function calculateTotal() {
    if (!state.visitType) return { lines: [], subtotal: 0, discount: 0, total: 0 };

    const lines = [];
    let billableItems = 0;

    // Base visit
    const basePrice = PRICING[state.visitType]?.[state.dayType] || 0;
    const visitTotal = basePrice * state.guests;
    lines.push({ label: `${VISIT_LABELS[state.visitType]} × ${state.guests}`, amount: visitTotal });
    billableItems++;

    // Treatments
    let treatmentTotal = 0;
    state.treatments.forEach(tid => {
      const t = TREATMENTS.find(x => x.id === tid);
      if (t) {
        const lineTotal = t.price * state.guests;
        treatmentTotal += lineTotal;
        lines.push({ label: `${t.name} × ${state.guests}`, amount: lineTotal });
        billableItems++;
      }
    });

    // Rasul
    if (state.rasul) {
      const g = Math.min(state.guests, 4);
      const rasulPrice = RASUL_PRICING[g] || (g * 20);
      lines.push({ label: `Rasul Mud Ritual (${g} guests)`, amount: rasulPrice });
      billableItems++;
    }

    // Departure spa
    if (state.departureSpa && isOvernight()) {
      const depPrice = PRICING.twilight[state.dayType] * state.guests;
      lines.push({ label: `Departure-day spa × ${state.guests}`, amount: depPrice });
      billableItems++;
    }

    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const tier = getDiscountTier(billableItems);
    const discount = Math.round(subtotal * tier.pct / 100);
    const total = subtotal - discount;

    return { lines, subtotal, discount, total, tier };
  }

  function updateBasket() {
    const calc = calculateTotal();

    if (!state.visitType) {
      basketItems.innerHTML = '<p style="font-size: 0.9rem; color: var(--color-text-light);">Select a visit type to begin.</p>';
      basketTotal.textContent = '0';
      basketSaving.style.display = 'none';
      return;
    }

    let html = '';
    calc.lines.forEach(l => {
      html += `<div class="basket-line"><span>${l.label}</span><span>&pound;${l.amount}</span></div>`;
    });

    if (calc.lines.length > 1) {
      html += `<div class="basket-line subtotal"><span>Subtotal</span><span>&pound;${calc.subtotal}</span></div>`;
    }

    basketItems.innerHTML = html;

    if (calc.discount > 0) {
      basketSaving.style.display = 'block';
      savingAmount.textContent = calc.discount;
      basketSaving.innerHTML = `${calc.tier.label} &mdash; you save <strong>&pound;${calc.discount}</strong>`;
    } else {
      basketSaving.style.display = 'none';
    }

    basketTotal.textContent = calc.total.toLocaleString();
  }

  // Review
  function renderReview() {
    const calc = calculateTotal();
    const reviewEl = document.getElementById('reviewSummary');

    let html = '<div style="margin-bottom: var(--space-md);">';
    html += `<div class="basket-line"><strong>Visit</strong><span>${VISIT_LABELS[state.visitType] || '—'}</span></div>`;
    html += `<div class="basket-line"><strong>Guests</strong><span>${state.guests}</span></div>`;

    const dateEl = document.getElementById('arrivalDate');
    if (dateEl.value) {
      const d = new Date(dateEl.value);
      html += `<div class="basket-line"><strong>Date</strong><span>${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>`;
    }

    if (state.treatments.length) {
      html += '<div style="margin-top: var(--space-sm);"><strong>Treatments</strong></div>';
      state.treatments.forEach(tid => {
        const t = TREATMENTS.find(x => x.id === tid);
        if (t) html += `<div class="basket-line"><span>${t.name} (${t.mins}min)</span><span>&pound;${t.price}pp</span></div>`;
      });
    }

    if (state.rasul) html += `<div class="basket-line"><span>Rasul Mud Ritual</span><span>Included</span></div>`;
    if (state.departureSpa) html += `<div class="basket-line"><span>Departure-day spa</span><span>Included</span></div>`;
    if (state.lunchVenue) html += `<div class="basket-line"><span>Lunch</span><span>${state.lunchVenue === 'restaurant' ? "Bertram's" : state.lunchVenue === 'terrace' ? 'Terrace Tapas' : 'Rooftop Pizza'}</span></div>`;
    if (state.dinnerVenue) html += `<div class="basket-line"><span>Dinner</span><span>Bertram's Restaurant</span></div>`;

    html += '</div>';

    if (calc.discount > 0) {
      html += `<div class="basket-saving">${calc.tier.label} &mdash; you save <strong>&pound;${calc.discount}</strong></div>`;
    }

    html += `<div class="basket-total"><span>Total</span><strong>&pound;${calc.total.toLocaleString()}</strong></div>`;
    reviewEl.innerHTML = html;
  }

  // Confirm
  document.getElementById('confirmBooking').addEventListener('click', () => {
    const overlay = document.getElementById('confirmOverlay');
    overlay.style.display = 'flex';
  });
});
