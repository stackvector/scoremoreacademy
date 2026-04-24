/* ─── nav.js — inject topbar, navbar, footer; handle mobile toggle ─── */

const PAGES = [
  { label: 'Home',         href: '../index.html',            key: 'home' },
  { label: 'About',        href: 'about.html',               key: 'about' },
  { label: 'Courses',      href: 'courses.html',             key: 'courses' },
  { label: 'Results',      href: 'results.html',             key: 'results' },
  { label: 'Testimonials', href: 'testimonials.html',        key: 'testimonials' },
  { label: 'Test Series',  href: 'test-series.html',         key: 'test-series' },
];

function buildTopbar() {
  return `
  <div class="topbar">
    <div class="topbar-left">
      <span>📍 H-48, Royal Garden Estate, Sec 61, Noida</span>
    </div>
    <div class="topbar-right">
      <a href="tel:9212395639">📞 9212395639</a>
      <a href="mailto:info@scoremoreacademy.com">✉️ info@scoremoreacademy.com</a>
    </div>
  </div>`;
}

function buildNavbar(activeKey) {
  const links = PAGES.map(p => `
    <li${p.key === 'test-series' ? ' class="nav-test-series"' : p.key === 'enroll' ? ' class="nav-enroll"' : ''}>
      <a href="${p.href}" class="${p.key === activeKey ? 'active' : ''}">${p.label}</a>
    </li>`).join('');

  return `
  <nav class="navbar">
    <a href="../index.html" class="brand">
      <div class="brand-icon">🎓</div>
      <div>
        <div class="brand-name">Score<span>More</span> Academy</div>
        <div class="brand-sub">From Concepts to Confidence</div>
      </div>
    </a>
    <button class="nav-toggle" aria-label="Toggle menu" onclick="toggleNav()">☰</button>
    <ul class="nav-links" id="navLinks">
      ${links}
      <li class="nav-enroll"><a href="enroll.html" class="${activeKey === 'enroll' ? 'active' : ''}">Enroll →</a></li>
    </ul>
  </nav>`;
}

function buildFooter() {
  return `
  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="brand-name">Score<span style="color:var(--gold)">More</span> Academy</div>
        <p>Expert Maths &amp; Science coaching for Classes 5–12. Small batches, deep concepts, real results — in Noida since 2004.</p>
      </div>
      <div>
        <h4>Quick Links</h4>
        <ul>
          <li><a href="../index.html">Home</a></li>
          <li><a href="about.html">About Us</a></li>
          <li><a href="courses.html">Courses</a></li>
          <li><a href="results.html">Results</a></li>
          <li><a href="testimonials.html">Testimonials</a></li>
          <li><a href="test-series.html">Test Series</a></li>
          <li><a href="enroll.html">Enroll Now</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="tel:9212395639">📞 9212395639</a></li>
          <li><a href="mailto:info@scoremoreacademy.com">✉️ info@scoremoreacademy.com</a></li>
          <li><a href="https://wa.me/919212395639" target="_blank">💬 WhatsApp Us</a></li>
        </ul>
        <div style="margin-top:14px; font-size:0.78rem; line-height:1.7;">
          H-48, Royal Garden Estate<br/>Sector 61, Noida — 201301
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2025 ScoreMore Academy. All rights reserved.</span>
      <em>"From Concepts to Confidence – ScoreMore Every Time!"</em>
    </div>
  </footer>
  <a class="wa-float" href="https://wa.me/919212395639" target="_blank" title="Chat on WhatsApp">💬</a>`;
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

function injectLayout(activeKey) {
  // Topbar
  const topbarEl = document.getElementById('topbar');
  if (topbarEl) topbarEl.innerHTML = buildTopbar();

  // Navbar
  const navbarEl = document.getElementById('navbar');
  if (navbarEl) navbarEl.innerHTML = buildNavbar(activeKey);

  // Footer
  const footerEl = document.getElementById('footer');
  if (footerEl) footerEl.innerHTML = buildFooter();
}
