// Password gate — sessionStorage so it persists across pages in the same tab
(function () {
  const PASS = 'pendle2026';
  if (sessionStorage.getItem('ws_auth') === '1') return;

  document.documentElement.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.id = 'pwGate';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;z-index:9999;background:#1B3B2F;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
      <div style="background:#FAF8F4;border-radius:12px;padding:2.5rem;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <img src="context/woodlandspa-scrape/images/The-Woodland-Spa-Logo-Transparent-Border.jpg" alt="The Woodland Spa" style="height:60px;margin:0 auto 1.5rem;">
        <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;margin-bottom:.5rem;color:#1B3B2F;">Concept Preview</p>
        <p style="font-size:.85rem;color:#5A5A5A;margin-bottom:1.5rem;">Enter the password to continue.</p>
        <input id="pwInput" type="password" placeholder="Password" autocomplete="off"
          style="width:100%;padding:.7rem 1rem;border:1px solid #E0DCD4;border-radius:4px;font-size:1rem;margin-bottom:.75rem;font-family:inherit;">
        <button id="pwSubmit"
          style="width:100%;padding:.75rem;background:#C4A265;color:#1B3B2F;border:none;border-radius:4px;font-weight:600;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;">
          Enter
        </button>
        <p id="pwError" style="color:#C1444B;font-size:.8rem;margin-top:.6rem;display:none;">Incorrect password</p>
      </div>
    </div>`;
  document.body.prepend(overlay);

  function attempt() {
    if (document.getElementById('pwInput').value === PASS) {
      sessionStorage.setItem('ws_auth', '1');
      overlay.remove();
      document.documentElement.style.overflow = '';
    } else {
      document.getElementById('pwError').style.display = 'block';
      document.getElementById('pwInput').value = '';
      document.getElementById('pwInput').focus();
    }
  }
  document.getElementById('pwSubmit').addEventListener('click', attempt);
  document.getElementById('pwInput').addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  document.getElementById('pwInput').focus();
})();

document.addEventListener('DOMContentLoaded', () => {

  // Mobile navigation toggle
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // Header scroll effect
  const header = document.querySelector('.site-header');
  if (header) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('scrolled', window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Scroll reveal animations
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // Active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      item.closest('.faq-list')?.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Menu tabs
  document.querySelectorAll('.menu-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      const parent = tab.closest('.menu-container');
      parent.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      parent.querySelector(`[data-menu="${target}"]`)?.classList.add('active');
    });
  });

  // Treatment filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      const container = btn.closest('section');
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      container.querySelectorAll('.treatment-group').forEach(group => {
        if (filter === 'all' || group.dataset.category === filter) {
          group.style.display = '';
        } else {
          group.style.display = 'none';
        }
      });
    });
  });
});
