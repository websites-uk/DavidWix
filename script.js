const nav = document.querySelector(".nav");
const menuToggle = document.querySelector(".menu-toggle");
const revealItems = document.querySelectorAll(".reveal");

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

menuToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach(item => observer.observe(item));

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", event => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});


// Premium entrance animation
window.addEventListener("DOMContentLoaded", () => {
  const loader = document.querySelector(".site-loader");
  if (!loader) return;
  setTimeout(() => loader.classList.add("loaded"), 2000);
});


// Repeating carousel hint: slide forward and return every 2.5 seconds
// while the category is visible, until the visitor interacts manually.
document.querySelectorAll(".work-category").forEach(category => {
  const track = category.querySelector(".project-carousel");
  const prev = category.querySelector(".carousel-prev");
  const next = category.querySelector(".carousel-next");
  if (!track) return;

  let hintTimer = null;
  let returnTimer = null;
  let stoppedByUser = false;
  let nudging = false;

  const stopHint = () => {
    stoppedByUser = true;
    if (hintTimer) window.clearInterval(hintTimer);
    if (returnTimer) window.clearTimeout(returnTimer);
    hintTimer = null;
    returnTimer = null;
  };

  ["pointerdown", "touchstart", "wheel", "keydown"].forEach(type => {
    track.addEventListener(type, stopHint, { passive: type !== "keydown", once: true });
  });
  prev?.addEventListener("click", stopHint, { once: true });
  next?.addEventListener("click", stopHint, { once: true });

  const hint = () => {
    if (stoppedByUser || nudging || track.scrollWidth <= track.clientWidth + 4) return;
    const start = track.scrollLeft;
    const card = track.querySelector(".carousel-card");
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const nudge = Math.min((card ? card.getBoundingClientRect().width + gap : 120) * 0.42, 180);
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (maxScroll <= 4) return;
    nudging = true;
    track.scrollTo({ left: Math.min(start + nudge, maxScroll), behavior: "smooth" });
    returnTimer = window.setTimeout(() => {
      if (!stoppedByUser) track.scrollTo({ left: start, behavior: "smooth" });
      nudging = false;
    }, 700);
  };

  const hintObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (stoppedByUser) return;
      if (entry.isIntersecting) {
        if (!hintTimer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.setTimeout(() => {
            if (!stoppedByUser && !hintTimer) hint();
          }, 500);
          hintTimer = window.setInterval(hint, 2500);
        }
      } else {
        if (hintTimer) window.clearInterval(hintTimer);
        hintTimer = null;
        if (returnTimer) window.clearTimeout(returnTimer);
        returnTimer = null;
        nudging = false;
      }
    });
  }, { threshold: 0.25 });
  hintObserver.observe(category);
});

// Horizontal project carousels: mouse, keyboard, touch and desktop arrow controls
document.querySelectorAll(".work-category").forEach(category => {
  const track = category.querySelector(".project-carousel");
  const prev = category.querySelector(".carousel-prev");
  const next = category.querySelector(".carousel-next");
  const current = category.querySelector(".carousel-current");
  if (!track || !prev || !next || !current) return;

  const cards = Array.from(track.querySelectorAll(".carousel-card"));
  const updateControls = () => {
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    prev.disabled = track.scrollLeft <= 3;
    next.disabled = track.scrollLeft >= maxScroll - 3;
    let activeIndex = 0;
    let closest = Infinity;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft);
      if (distance < closest) {
        closest = distance;
        activeIndex = index;
      }
    });
    current.textContent = String(activeIndex + 1).padStart(2, "0");
  };

  const move = direction => {
    const card = cards[0];
    if (!card) return;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    track.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  prev.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  track.addEventListener("scroll", updateControls, { passive: true });
  track.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  });
  window.addEventListener("resize", updateControls, { passive: true });
  updateControls();
});
