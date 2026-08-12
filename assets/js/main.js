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

  /* ---------------- Auto-upgrade screenshots → recordings ---------------- */
  // Each img.shot[data-clip] names an OPTIONAL video (e.g. shots/search.mp4).
  // If that file exists, swap in an autoplaying, muted, looping clip; if it's
  // not there yet, the screenshot simply stays. So dropping the .mp4 files in
  // later upgrades the site to real recordings with no code change.
  document.querySelectorAll("img.shot[data-clip]").forEach(function (img) {
    var src = img.getAttribute("data-clip");
    if (!src) { return; }
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
    v.className = img.className; v.setAttribute("aria-label", img.alt || "");
    v.addEventListener("loadeddata", function () {
      if (img.parentElement) { img.replaceWith(v); v.play().catch(function () {}); }
    });
    // On error (no clip yet) do nothing — the screenshot remains.
    v.src = src;
  });

  /* ---------------- "See it in action" showcase ---------------- */
  // A reel of real recordings. Video slides play from the start and advance
  // when the clip ENDS (so full clips play, not fixed-length cuts); image
  // slides advance on a short timer. Hover pauses; dots jump.
  var showcase = document.querySelector(".showcase");
  if (showcase) {
    var slides = Array.prototype.slice.call(showcase.querySelectorAll(".showcase-slide"));
    var dots = Array.prototype.slice.call(showcase.querySelectorAll(".showcase-dot"));
    var caption = showcase.querySelector(".showcase-caption");
    var prevBtn = showcase.querySelector(".showcase-nav.prev");
    var nextBtn = showcase.querySelector(".showcase-nav.next");
    var idx = 0, timer = null, hovering = false, inview = false, started = false;
    var IMG_MS = 4200, SAFETY_MS = 32000;
    var vidOf = function (i) { return slides[i] ? slides[i].querySelector("video") : null; };
    var clearTimer = function () { if (timer) { clearTimeout(timer); timer = null; } };
    var schedule = function () {
      clearTimer();
      var v = vidOf(idx);
      // Video slides advance on 'ended'; a safety cap covers a stalled clip.
      timer = setTimeout(next, v ? SAFETY_MS : IMG_MS);
    };
    var render = function () {
      slides.forEach(function (s, j) { s.classList.toggle("active", j === idx); });
      dots.forEach(function (d, j) { d.classList.toggle("active", j === idx); });
      if (caption) { caption.textContent = slides[idx].getAttribute("data-caption") || ""; }
    };
    // Change to slide i; play it from the start only while visible & not hovered.
    var go = function (i) {
      idx = (i + slides.length) % slides.length;
      render();
      slides.forEach(function (s) { var vv = s.querySelector("video"); if (vv) { try { vv.pause(); } catch (e) {} } });
      if (inview && !hovering) {
        var v = vidOf(idx);
        if (v) { try { v.currentTime = 0; } catch (e) {} v.play().catch(function () {}); }
        schedule();
      } else { clearTimer(); }
    };
    var next = function () { go(idx + 1); };
    var prev = function () { go(idx - 1); };
    slides.forEach(function (s) {
      var v = s.querySelector("video");
      if (v) { v.addEventListener("ended", function () { if (inview && !hovering && slides[idx] === s) { next(); } }); }
    });
    dots.forEach(function (d, j) { d.addEventListener("click", function () { go(j); }); });
    if (prevBtn) { prevBtn.addEventListener("click", prev); }
    if (nextBtn) { nextBtn.addEventListener("click", next); }
    showcase.addEventListener("mouseenter", function () { hovering = true; clearTimer(); var v = vidOf(idx); if (v) { try { v.pause(); } catch (e) {} } });
    showcase.addEventListener("mouseleave", function () { hovering = false; if (inview) { var v = vidOf(idx); if (v) { v.play().catch(function () {}); } schedule(); } });

    // Start from clip 1 only when the reel scrolls into view; pause it off-screen.
    var inViewCheck = function () {
      var r = showcase.getBoundingClientRect();
      var vis = r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
      if (vis && !inview) {
        inview = true;
        if (!started) { started = true; go(0); }
        else if (!hovering) { var v = vidOf(idx); if (v) { v.play().catch(function () {}); } schedule(); }
      } else if (!vis && inview) {
        inview = false; clearTimer();
        var vv = vidOf(idx); if (vv) { try { vv.pause(); } catch (e) {} }
      }
    };
    if (slides.length) {
      render();
      window.addEventListener("scroll", inViewCheck, { passive: true });
      window.addEventListener("resize", inViewCheck);
      inViewCheck();
    }
  }
})();
