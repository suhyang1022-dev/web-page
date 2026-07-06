(function () {
  var toggle = document.getElementById("theme-toggle");
  var root = document.documentElement;
  var scene = document.querySelector(".scroll-scene");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ticking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mapRange(value, inMin, inMax, outMin, outMax) {
    var progress = clamp((value - inMin) / (inMax - inMin), 0, 1);
    return outMin + (outMax - outMin) * progress;
  }

  function getTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function updateButton(theme) {
    if (!toggle) {
      return;
    }

    if (theme === "dark") {
      toggle.textContent = "라이트 모드";
      toggle.setAttribute("aria-label", "라이트 모드로 전환");
    } else {
      toggle.textContent = "다크 모드";
      toggle.setAttribute("aria-label", "다크 모드로 전환");
    }
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    updateButton(theme);
  }

  function setScrollVars(progress) {
    var flipProgress = clamp(progress / 0.45, 0, 1);
    var zoomProgress = clamp((progress - 0.45) / 0.35, 0, 1);
    var detailProgress = clamp((progress - 0.72) / 0.18, 0, 1);
    var isMobile = window.matchMedia("(max-width: 760px)").matches;
    var maxScale = isMobile ? 1.08 : 1.35;

    var rotateY = mapRange(flipProgress, 0, 1, 0, 180);
    var scale = mapRange(zoomProgress, 0, 1, 1, maxScale);
    var tiltX = mapRange(progress, 0, 0.75, 10, 0);
    var tiltZ = mapRange(progress, 0, 0.75, -7, 0);

    root.style.setProperty("--flip-progress", flipProgress.toFixed(3));
    root.style.setProperty("--zoom-progress", zoomProgress.toFixed(3));
    root.style.setProperty("--card-rotate-y", rotateY.toFixed(2) + "deg");
    root.style.setProperty("--card-scale", scale.toFixed(3));
    root.style.setProperty("--card-tilt-x", tiltX.toFixed(2) + "deg");
    root.style.setProperty("--card-tilt-z", tiltZ.toFixed(2) + "deg");
    root.style.setProperty("--back-opacity", flipProgress.toFixed(3));
    root.style.setProperty("--detail-opacity", detailProgress.toFixed(3));
  }

  function updateScrollScene() {
    ticking = false;

    if (!scene || reduceMotion) {
      return;
    }

    var rect = scene.getBoundingClientRect();
    var scrollable = Math.max(scene.offsetHeight - window.innerHeight, 1);
    var progress = clamp(-rect.top / scrollable, 0, 1);

    setScrollVars(progress);
  }

  function requestScrollUpdate() {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(updateScrollScene);
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  }

  if (reduceMotion) {
    setScrollVars(1);
  } else {
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
    requestScrollUpdate();
  }

  updateButton(getTheme());
})();
