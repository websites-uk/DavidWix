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


// Four-second branded intro, with an immediate failsafe if the page script is delayed.
(() => {
  const startedAt = performance.now();
  const finishLoader = () => {
    const loader = document.querySelector(".site-loader");
    if (!loader || loader.classList.contains("loaded")) return;
    const remaining = Math.max(0, 4000 - (performance.now() - startedAt));
    window.setTimeout(() => loader.classList.add("loaded"), remaining);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finishLoader, { once: true });
  } else {
    finishLoader();
  }
  window.setTimeout(() => {
    document.querySelector(".site-loader")?.classList.add("loaded");
  }, 4500);
})();

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


// Cinematic graphic rail: seamless loop, click-to-pause, drag/swipe and keyboard navigation.
(() => {
  const rail = document.querySelector("#graphics-rail");
  const track = rail?.querySelector(".graphics-track");
  const status = document.querySelector("#graphics-rail-status");
  if (!rail || !track) return;

  // Duplicate the artwork once so the right-to-left loop has no empty gap.
  if (!track.dataset.loopReady) {
    Array.from(track.children).forEach(card => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("img").forEach(img => img.setAttribute("alt", ""));
      track.appendChild(clone);
    });
    track.dataset.loopReady = "true";
  }

  let paused = false;
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;

  const updateStatus = () => {
    if (status) status.textContent = paused ? "MOTION PAUSED · CLICK TO RESUME" : "AUTOPLAY ACTIVE · CLICK TO PAUSE";
    rail.classList.toggle("is-paused", paused);
    rail.setAttribute("aria-label", paused
      ? "Graphic design gallery paused. Click to resume or drag to explore."
      : "Cinematic graphic design gallery. Click to pause or resume. Use arrow keys or drag to explore.");
  };

  rail.addEventListener("click", event => {
    if (moved) { moved = false; return; }
    if (event.target.closest("a, button")) return;
    paused = !paused;
    updateStatus();
  });

  rail.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startScroll = rail.scrollLeft;
    rail.classList.add("is-dragging", "is-paused");
    rail.setPointerCapture?.(event.pointerId);
  });
  rail.addEventListener("pointermove", event => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 5) moved = true;
    if (moved) {
      paused = true;
      rail.scrollLeft = startScroll - delta;
      updateStatus();
    }
  });
  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    rail.classList.remove("is-dragging");
    if (moved) {
      paused = true;
      updateStatus();
      window.setTimeout(() => { moved = false; }, 0);
    }
  };
  rail.addEventListener("pointerup", finishDrag);
  rail.addEventListener("pointercancel", finishDrag);
  rail.addEventListener("lostpointercapture", finishDrag);

  rail.addEventListener("keydown", event => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      paused = true;
      rail.scrollBy({ left: event.key === "ArrowRight" ? 320 : -320, behavior: "smooth" });
      updateStatus();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      paused = !paused;
      updateStatus();
    }
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) paused = true;
  updateStatus();
})();


// Project preview performance: load external website iframes only as their cards approach view.
(() => {
  const frames = document.querySelectorAll(".project-preview iframe[data-src]");
  if (!frames.length) return;
  const loadFrame = frame => {
    if (!frame.dataset.src || frame.dataset.loaded === "true") return;
    frame.dataset.loaded = "true";
    frame.src = frame.dataset.src;
    frame.removeAttribute("data-src");
  };
  if (!("IntersectionObserver" in window)) {
    frames.forEach(loadFrame);
    return;
  }
  const previewObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadFrame(entry.target);
        previewObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "100px 0px", threshold: 0.01 });
  frames.forEach(frame => previewObserver.observe(frame));
})();
