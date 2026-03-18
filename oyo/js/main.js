document.addEventListener('DOMContentLoaded', function () {

    /* ── Lucide icons ──────────────────────────────────────── */
    if (window.lucide) lucide.createIcons();

    /* ── Mobile nav toggle ─────────────────────────────────── */
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', function () {
            links.classList.toggle('open');
            var icon = toggle.querySelector('i');
            if (icon) {
                var isOpen = links.classList.contains('open');
                icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
                if (window.lucide) lucide.createIcons();
            }
        });

        links.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                links.classList.remove('open');
            });
        });
    }

    /* ── FAQ accordion ─────────────────────────────────────── */
    document.querySelectorAll('.faq-question').forEach(function (q) {
        q.addEventListener('click', function () {
            var item = q.closest('.faq-item');
            var wasOpen = item.classList.contains('open');

            item.classList.toggle('open');

            var answer = item.querySelector('.faq-answer');
            if (answer) {
                if (wasOpen) {
                    answer.style.maxHeight = '0';
                } else {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                }
            }
        });
    });

    /* ── Scroll fade-in ────────────────────────────────────── */
    var fadeEls = document.querySelectorAll('.fade-in');
    if (fadeEls.length && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        fadeEls.forEach(function (el) { observer.observe(el); });
    } else {
        fadeEls.forEach(function (el) { el.classList.add('visible'); });
    }

    /* ── Smooth scroll for anchor links ────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var id = a.getAttribute('href');
            if (id && id !== '#') {
                var target = document.querySelector(id);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
});
