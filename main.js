(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const shotsEl = document.getElementById("shots");
  const starsEl = document.getElementById("stars");
  const totalStarsEl = document.getElementById("totalStars");
  const levelEl = document.getElementById("level");
  const bestShotsEl = document.getElementById("bestShots");
  const hintEl = document.getElementById("hint");
  const overlayEl = document.getElementById("levelCompleteOverlay");
  const overlayNextBtn = document.getElementById("overlayNextLevel");

  const resetBtn = document.getElementById("resetLevel");
  const nextBtn = document.getElementById("nextLevel");
  const randomBtn = document.getElementById("randomize");

  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    requestRender();
  });

  // Strong gravity and slower simulation to make curves very obvious
  const G = 420000;
  const TIME_STEP = 1 / 75;
  const MAX_TRAIL = 120;
  const MAX_GHOST_TRAIL = 600;

  const puck = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 7,
    alive: false,
    trail: [],
    fullTrail: [],
  };

  let lastTrail = [];

  let launcher = { x: width * 0.12, y: height * 0.5, radius: 11 };

  let planets = [];
  let stars = [];
  let explosions = [];
  const bestShotsByLevel = {};
  let shots = 0;
  let collectedStars = 0;
  let totalStars = 0;
  let levelIndex = 0;
  let currentLevelName = "";

  let isDragging = false;
  let dragStart = null;
  let dragCurrent = null;

  let animationFrameId = null;
  let playing = true;

  function requestRender() {
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  const baseLevels = [
    {
      name: "Slingshot Basics",
      hint: "Shoot past the planet so its gravity bends your path into the star.",
      planets: [{ xFactor: 0.45, yFactor: 0.5, mass: 8, radius: 36, spin: 0 }],
      stars: [{ xFactor: 0.8, yFactor: 0.5 }],
    },
    {
      name: "Double Curve",
      hint: "Use both planets: skim one, then swing around the other.",
      planets: [
        { xFactor: 0.4, yFactor: 0.45, mass: 9, radius: 36, spin: 0.15 },
        { xFactor: 0.65, yFactor: 0.58, mass: 9, radius: 34, spin: -0.18 },
      ],
      stars: [
        { xFactor: 0.83, yFactor: 0.45 },
        { xFactor: 0.83, yFactor: 0.65 },
      ],
    },
    {
      name: "Thread the Needle",
      hint: "Aim between the planets; a shallow curve can pick up both stars.",
      planets: [
        { xFactor: 0.5, yFactor: 0.4, mass: 10, radius: 34, spin: 0.15 },
        { xFactor: 0.5, yFactor: 0.6, mass: 10, radius: 34, spin: -0.15 },
      ],
      stars: [
        { xFactor: 0.8, yFactor: 0.4 },
        { xFactor: 0.8, yFactor: 0.6 },
      ],
    },
    {
      name: "Orbital Carousel",
      hint: "Try to park in orbit and graze each star.",
      planets: [
        { xFactor: 0.6, yFactor: 0.5, mass: 14, radius: 42, spin: 0.25 },
      ],
      stars: [
        { xFactor: 0.8, yFactor: 0.35 },
        { xFactor: 0.86, yFactor: 0.5 },
        { xFactor: 0.8, yFactor: 0.65 },
      ],
    },
    {
      name: "Tight Binary",
      hint: "Aim between the twins; a late curve can catch both stars.",
      planets: [
        { xFactor: 0.48, yFactor: 0.48, mass: 11, radius: 30, spin: 0.28 },
        { xFactor: 0.52, yFactor: 0.52, mass: 11, radius: 30, spin: -0.28 },
      ],
      stars: [
        { xFactor: 0.75, yFactor: 0.38 },
        { xFactor: 0.78, yFactor: 0.62 },
      ],
    },
    {
      name: "Gauntlet Run",
      hint: "Use small slings to snake through the corridor.",
      planets: [
        { xFactor: 0.35, yFactor: 0.35, mass: 8, radius: 26, spin: 0.1 },
        { xFactor: 0.42, yFactor: 0.6, mass: 9, radius: 28, spin: -0.1 },
        { xFactor: 0.58, yFactor: 0.4, mass: 9, radius: 30, spin: 0.12 },
        { xFactor: 0.66, yFactor: 0.62, mass: 10, radius: 32, spin: -0.14 },
      ],
      stars: [
        { xFactor: 0.72, yFactor: 0.32 },
        { xFactor: 0.82, yFactor: 0.48 },
        { xFactor: 0.72, yFactor: 0.66 },
      ],
    },
  ];

  function createLevelFromConfig(config) {
    planets = config.planets.map((p) => ({
      x: p.xFactor * width,
      y: p.yFactor * height,
      mass: p.mass,
      radius: p.radius,
      spin: p.spin,
      angle: Math.random() * Math.PI * 2,
    }));
    stars = config.stars.map((s) => ({
      x: s.xFactor * width,
      y: s.yFactor * height,
      radius: 14,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    }));
    explosions = [];
    launcher.x = width * 0.12;
    launcher.y = height * 0.5;
    shots = 0;
    collectedStars = 0;
    totalStars = stars.length;
    totalStarsEl.textContent = totalStars;
    currentLevelName = config.name;
    levelEl.textContent = `${levelIndex + 1} – ${currentLevelName}`;
    const best = bestShotsByLevel[currentLevelName];
    bestShotsEl.textContent = Number.isFinite(best) ? best : "–";
    hintEl.textContent =
      config.hint +
      " Tip: Longer drags = faster shots, but too fast can escape gravity.";
    resetPuck();
    requestRender();
  }

  function randomLevel() {
    const planetCount = 2 + Math.floor(Math.random() * 3); // 2-4
    const starCount = 2 + Math.floor(Math.random() * 4); // 2-5
    const planetsConfig = [];
    const starsConfig = [];

    for (let i = 0; i < planetCount; i++) {
      const xFactor = 0.25 + Math.random() * 0.6;
      const yFactor = 0.15 + Math.random() * 0.7;
      const mass = 7 + Math.random() * 10;
      const radius = 28 + Math.random() * 22;
      const spin = (Math.random() - 0.5) * 0.5;
      planetsConfig.push({ xFactor, yFactor, mass, radius, spin });
    }
    for (let i = 0; i < starCount; i++) {
      const xFactor = 0.4 + Math.random() * 0.55;
      const yFactor = 0.2 + Math.random() * 0.6;
      starsConfig.push({ xFactor, yFactor });
    }

    return {
      name: "Random System",
      hint: "Explore! Each random system has its own tricky gravity puzzle.",
      planets: planetsConfig,
      stars: starsConfig,
    };
  }

  function resetPuck() {
    if (puck.fullTrail.length > 1) {
      lastTrail = puck.fullTrail.map((p) => ({ x: p.x, y: p.y }));
    }
    puck.x = launcher.x;
    puck.y = launcher.y;
    puck.vx = 0;
    puck.vy = 0;
    puck.trail.length = 0;
    puck.fullTrail.length = 0;
    puck.alive = false;
  }

  function spawnExplosion(x, y) {
    const particles = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 140 + Math.random() * 220;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
    explosions.push({ particles });
  }

  function firePuck(targetX, targetY) {
    const dx = targetX - launcher.x;
    const dy = targetY - launcher.y;
    const maxDrag = Math.min(width, height) * 0.35;
    const dragLength = Math.hypot(dx, dy);
    const clamped = Math.min(maxDrag, dragLength);
    const strength = clamped / maxDrag;
    // Much lower base and top speed so gravity dominates
    const speed = 160 + strength * 260;

    const angle = Math.atan2(dy, dx);
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
    puck.trail.length = 0;
    puck.alive = true;
    shots += 1;
    shotsEl.textContent = shots;
  }

  function getDragPreview(targetX, targetY) {
    const dx = targetX - launcher.x;
    const dy = targetY - launcher.y;
    const maxDrag = Math.min(width, height) * 0.35;
    const dragLength = Math.hypot(dx, dy);
    const clamped = Math.min(maxDrag, dragLength);
    const strength = clamped / maxDrag;
    const speed = 160 + strength * 260;
    const angle = Math.atan2(dy, dx);
    return { angle, strength, speed };
  }

  function updatePhysics(dt) {
    if (!puck.alive) return;

    let ax = 0;
    let ay = 0;
    for (const planet of planets) {
      const dx = planet.x - puck.x;
      const dy = planet.y - puck.y;
      const distSq = dx * dx + dy * dy;
      const minDist = planet.radius + puck.radius + 6;
      const minDistSq = minDist * minDist;

      if (distSq < minDistSq * 0.85) {
        resetPuck();
        return;
      }

      const dist = Math.sqrt(distSq) + 0.0001;
      const force = (G * planet.mass) / (distSq + 2800);
      ax += (force * dx) / dist;
      ay += (force * dy) / dist;
    }

    const damping = 0.999;
    puck.vx += ax * dt;
    puck.vy += ay * dt;
    puck.vx *= damping;
    puck.vy *= damping;

    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;

    const point = { x: puck.x, y: puck.y };
    puck.trail.push(point);
    puck.fullTrail.push(point);
    if (puck.trail.length > MAX_TRAIL) puck.trail.shift();
    if (puck.fullTrail.length > MAX_GHOST_TRAIL) puck.fullTrail.shift();

    if (
      puck.x < -150 ||
      puck.x > width + 150 ||
      puck.y < -150 ||
      puck.y > height + 150
    ) {
      resetPuck();
    }

    for (const star of stars) {
      if (star.collected) continue;
      const dx = star.x - puck.x;
      const dy = star.y - puck.y;
      const d = Math.hypot(dx, dy);
      if (d < star.radius + puck.radius + 2) {
        star.collected = true;
        spawnExplosion(star.x, star.y);
        collectedStars += 1;
        starsEl.textContent = collectedStars;
        if (collectedStars === totalStars) {
          const levelName = currentLevelName || "Random System";
          const best = bestShotsByLevel[levelName];
          if (!best || shots < best) {
            bestShotsByLevel[levelName] = shots;
            bestShotsEl.textContent = shots;
          }
          hintEl.textContent =
            "You collected all stars! Choose 'Next Level' to advance or 'Reset Level' to replay this level.";
          if (overlayEl) {
            overlayEl.classList.add("visible");
          }
        }
      }
    }
  }

  function predictPath(angle, speed) {
    const preview = [];
    let px = launcher.x;
    let py = launcher.y;
    let pvx = Math.cos(angle) * speed;
    let pvy = Math.sin(angle) * speed;
    const damping = 0.999;
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      let ax = 0;
      let ay = 0;
      for (const planet of planets) {
        const dx = planet.x - px;
        const dy = planet.y - py;
        const distSq = dx * dx + dy * dy;
        const minDist = planet.radius + puck.radius + 6;
        if (distSq < minDist * minDist) {
          return preview;
        }
        const dist = Math.sqrt(distSq) + 0.0001;
        const force = (G * planet.mass) / (distSq + 2800);
        ax += (force * dx) / dist;
        ay += (force * dy) / dist;
      }
      pvx += ax * TIME_STEP;
      pvy += ay * TIME_STEP;
      pvx *= damping;
      pvy *= damping;
      px += pvx * TIME_STEP;
      py += pvy * TIME_STEP;
      if (
        px < -200 ||
        px > width + 200 ||
        py < -200 ||
        py > height + 200
      ) {
        return preview;
      }
      if (i % 2 === 0) {
        preview.push({ x: px, y: py });
      }
    }
    return preview;
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(
      width * 0.2,
      height * 0.1,
      0,
      width * 0.5,
      height * 0.6,
      Math.max(width, height)
    );
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(0.4, "#020617");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    for (let i = 0; i < 70; i++) {
      const x = ((i * 73) % width) + (Math.sin(i * 12.3) * 17);
      const y =
        ((i * 51) % height) +
        (Math.sin(Date.now() * 0.0002 + i * 0.4) * 4);
      ctx.globalAlpha = 0.2 + ((i * 37) % 100) / 200;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.restore();
  }

  function drawPlanets(dt) {
    for (const planet of planets) {
      planet.angle += planet.spin * dt;
      ctx.save();
      ctx.translate(planet.x, planet.y);

      const g = ctx.createRadialGradient(
        -planet.radius * 0.3,
        -planet.radius * 0.35,
        planet.radius * 0.2,
        0,
        0,
        planet.radius
      );
      g.addColorStop(0, "#f97316");
      g.addColorStop(0.4, "#e11d48");
      g.addColorStop(1, "#4c1d95");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, planet.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1.2;
      const ringCount = 3;
      for (let i = 1; i <= ringCount; i++) {
        const r = planet.radius * (1 + i * 0.28);
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          r,
          planet.angle + i * 0.4,
          planet.angle + Math.PI * 1.4 + i * 0.4
        );
        ctx.strokeStyle = `rgba(129,140,248,${0.45 - i * 0.12})`;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      const fieldGradient = ctx.createRadialGradient(
        planet.x,
        planet.y,
        planet.radius * 0.5,
        planet.x,
        planet.y,
        planet.radius * 3.3
      );
      fieldGradient.addColorStop(0, "rgba(94, 234, 212, 0.18)");
      fieldGradient.addColorStop(0.7, "rgba(94, 234, 212, 0.04)");
      fieldGradient.addColorStop(1, "rgba(94, 234, 212, 0)");
      ctx.fillStyle = fieldGradient;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, planet.radius * 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawStars(dt) {
    for (const star of stars) {
      star.pulse += dt * 3;
      const pulse = 0.3 + Math.sin(star.pulse) * 0.2;
      const r = star.radius * (1 + pulse * 0.5);
      const glow = star.radius * 3.5;

      if (!star.collected) {
        ctx.save();
        const g = ctx.createRadialGradient(
          star.x,
          star.y,
          0,
          star.x,
          star.y,
          glow
        );
        g.addColorStop(0, "rgba(251, 191, 36, 0.9)");
        g.addColorStop(0.5, "rgba(251, 191, 36, 0.25)");
        g.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(star.x, star.y, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(star.x, star.y);
        ctx.rotate(Math.sin(star.pulse * 0.7) * 0.4);
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const outerR = r;
          const innerR = r * 0.45;
          ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          const next = angle + Math.PI / 5;
          ctx.lineTo(Math.cos(next) * innerR, Math.sin(next) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "rgba(148,163,184,0.5)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, r * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawExplosions(dt) {
    if (!explosions.length) return;
    ctx.save();
    for (let i = explosions.length - 1; i >= 0; i--) {
      const explosion = explosions[i];
      let alive = false;
      for (const p of explosion.particles) {
        p.life += dt;
        if (p.life >= p.maxLife) continue;
        alive = true;
        const t = p.life / p.maxLife;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        const alpha = 1 - t;
        const size = 2 + (1 - t) * 2;
        const color = t < 0.4 ? "255, 251, 235" : "248, 250, 252";
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!alive) {
        explosions.splice(i, 1);
      }
    }
    ctx.restore();
  }

  function drawLauncher() {
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, launcher.radius + 10, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(
      launcher.x - 4,
      launcher.y - 4,
      3,
      launcher.x,
      launcher.y,
      launcher.radius + 6
    );
    g.addColorStop(0, "#22c55e");
    g.addColorStop(0.6, "#16a34a");
    g.addColorStop(1, "#0f766e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, launcher.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(34,197,94,0.35)";
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, launcher.radius + 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (isDragging && dragStart && dragCurrent) {
      const { angle, strength, speed } = getDragPreview(
        dragCurrent.x,
        dragCurrent.y
      );
      const guideLen = 70 + strength * 120;
      const preview = predictPath(angle, speed);

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(96,165,250,0.8)";
      ctx.beginPath();
      ctx.moveTo(launcher.x, launcher.y);
      ctx.lineTo(
        launcher.x + Math.cos(angle) * guideLen,
        launcher.y + Math.sin(angle) * guideLen
      );
      ctx.stroke();

      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(59,130,246,0.6)";
      ctx.beginPath();
      for (let i = 0; i < preview.length; i++) {
        const p = preview[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(launcher.x, launcher.y, launcher.radius + 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(22,163,74,0.8)";
      ctx.beginPath();
      ctx.arc(
        launcher.x,
        launcher.y,
        launcher.radius + 18,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * strength
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPuck() {
    ctx.save();
    if (lastTrail.length > 1) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < lastTrail.length; i++) {
        const { x, y } = lastTrail[i];
        const t = i / lastTrail.length;
        ctx.strokeStyle = `rgba(148, 163, 184, ${t * 0.45})`;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (puck.trail.length > 1) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < puck.trail.length; i++) {
        const { x, y } = puck.trail[i];
        const t = i / puck.trail.length;
        ctx.strokeStyle = `rgba(96, 165, 250, ${t * 0.9})`;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
    ctx.fill();

    const speed = Math.hypot(puck.vx, puck.vy);
    const eyeOffset = Math.min(4, speed / 150);
    const angle = Math.atan2(puck.vy, puck.vx);
    const ox = Math.cos(angle) * eyeOffset;
    const oy = Math.sin(angle) * eyeOffset;

    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.arc(puck.x + ox, puck.y + oy, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function loop(timestamp) {
    animationFrameId = null;
    if (!playing) return;
    const dt = TIME_STEP;
    updatePhysics(dt);
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawPlanets(dt);
    drawStars(dt);
    drawExplosions(dt);
    drawLauncher();
    drawPuck();
    requestRender();
  }

  function canvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function touchCoords(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  canvas.addEventListener("mousedown", (evt) => {
    const pos = canvasCoords(evt);
    const dx = pos.x - launcher.x;
    const dy = pos.y - launcher.y;
    if (Math.hypot(dx, dy) <= launcher.radius + 30) {
      isDragging = true;
      dragStart = { x: launcher.x, y: launcher.y };
      dragCurrent = { ...pos };
    }
  });

  canvas.addEventListener("mousemove", (evt) => {
    if (!isDragging) return;
    dragCurrent = canvasCoords(evt);
  });

  canvas.addEventListener("mouseup", (evt) => {
    if (!isDragging) return;
    const pos = canvasCoords(evt);
    isDragging = false;
    dragCurrent = null;
    firePuck(pos.x, pos.y);
    starsEl.textContent = collectedStars;
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    dragCurrent = null;
  });

  canvas.addEventListener(
    "touchstart",
    (evt) => {
      const touch = evt.touches[0];
      if (!touch) return;
      const pos = touchCoords(touch);
      const dx = pos.x - launcher.x;
      const dy = pos.y - launcher.y;
      if (Math.hypot(dx, dy) <= launcher.radius + 30) {
        isDragging = true;
        dragStart = { x: launcher.x, y: launcher.y };
        dragCurrent = { ...pos };
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (evt) => {
      if (!isDragging) return;
      const touch = evt.touches[0];
      if (!touch) return;
      dragCurrent = touchCoords(touch);
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    (evt) => {
      if (!isDragging) return;
      const touch = evt.changedTouches[0];
      if (!touch) return;
      const pos = touchCoords(touch);
      isDragging = false;
      dragCurrent = null;
      firePuck(pos.x, pos.y);
      starsEl.textContent = collectedStars;
    },
    { passive: true }
  );

  canvas.addEventListener("touchcancel", () => {
    isDragging = false;
    dragCurrent = null;
  });

  resetBtn.addEventListener("click", () => {
    stars.forEach((s) => (s.collected = false));
    collectedStars = 0;
    shots = 0;
    shotsEl.textContent = shots;
    starsEl.textContent = collectedStars;
    hintEl.textContent =
      "Level reset. Try adjusting your launch angle or speed.";
    lastTrail = [];
    explosions = [];
    resetPuck();
    requestRender();
  });

  nextBtn.addEventListener("click", () => {
    levelIndex = (levelIndex + 1) % baseLevels.length;
    lastTrail = [];
    explosions = [];
    if (overlayEl) {
      overlayEl.classList.remove("visible");
    }
    createLevelFromConfig(baseLevels[levelIndex]);
  });

  randomBtn.addEventListener("click", () => {
    const config = randomLevel();
    levelIndex = 0;
    lastTrail = [];
    explosions = [];
    createLevelFromConfig(config);
  });

  if (overlayNextBtn) {
    overlayNextBtn.addEventListener("click", () => {
      nextBtn.click();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      resetBtn.click();
    }
  });

  function init() {
    starsEl.textContent = collectedStars;
    shotsEl.textContent = shots;
    totalStarsEl.textContent = 0;
    createLevelFromConfig(baseLevels[levelIndex]);
    requestRender();
  }

  init();
})();
