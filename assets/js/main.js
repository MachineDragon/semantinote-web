/* SemantiNote marketing site — tiny vanilla JS
   - mobile nav toggle
   - OS detection (highlights the matching download card)
   - scroll-reveal animations
   - graceful screenshot fallback (placeholder if an image is missing) */

(function () {
  "use strict";

  // Mark JS active so the reveal CSS engages. Without JS, content stays visible.
  document.documentElement.classList.add("js");

  /* ---------------- Mobile nav toggle ---------------- */
  var nav = document.getElementById("nav");
  var toggle = document.getElementById("navToggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      nav.setAttribute("data-open", nav.getAttribute("data-open") === "true" ? "false" : "true");
    });
    // Close the menu after tapping a link.
    nav.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () { nav.setAttribute("data-open", "false"); });
    });
  }

  /* ---------------- OS detection (download page) ---------------- */
  function detectOS() {
    var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    var ua = navigator.userAgent || "";
    p = p.toLowerCase(); ua = ua.toLowerCase();
    if (p.indexOf("mac") > -1 || ua.indexOf("mac") > -1) { return "mac"; }
    if (p.indexOf("win") > -1 || ua.indexOf("win") > -1) { return "win"; }
    return "other";
  }

  var osHint = document.getElementById("osHint");
  if (osHint) {
    var os = detectOS();
    var macCard = document.getElementById("macCard");
    var winCard = document.getElementById("winCard");
    var macBadge = document.getElementById("macBadge");
    var winBadge = document.getElementById("winBadge");
    if (os === "mac") {
      osHint.textContent = "Looks like you're on a Mac — the macOS build is highlighted below.";
      if (macBadge) { macBadge.hidden = false; }
      if (winCard) { winCard.classList.remove("recommended"); }
    } else if (os === "win") {
      osHint.textContent = "Looks like you're on Windows — the Windows build is highlighted below.";
      if (winBadge) { winBadge.hidden = false; }
      if (winCard) { winCard.classList.add("recommended"); }
      if (macCard) { macCard.classList.remove("recommended"); }
    } else {
      osHint.textContent = "Available for macOS and Windows.";
    }
  }

  /* ---------------- Scroll reveal ---------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- Screenshot fallback ---------------- */
  // If a screenshot hasn't been captured yet, swap in a tasteful placeholder so
  // the layout never shows a broken-image icon.
  var PH = '<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Screenshot coming soon</span></div>';
  document.querySelectorAll("img.shot").forEach(function (img) {
    img.addEventListener("error", function () {
      var frame = img.parentElement;
      if (frame) { img.remove(); frame.insertAdjacentHTML("beforeend", PH); }
    });
  });
})();
