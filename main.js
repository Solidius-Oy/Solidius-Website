(function () {
    "use strict";

    /* ===== Navigation scroll visibility ===== */
    const nav = document.getElementById("nav");
    const hero = document.getElementById("hero");
    let heroHeight = window.innerHeight;

    function handleNavVisibility() {
        if (window.scrollY > heroHeight * 0.75) {
            nav.classList.add("visible");
        } else {
            nav.classList.remove("visible");
        }
    }

    /* ===== Hero fade on scroll ===== */
    function handleHeroFade() {
        const scrollY = window.scrollY;
        const opacity = Math.max(0, 1 - scrollY / (heroHeight * 0.6));
        hero.style.opacity = opacity;
    }

    window.addEventListener(
        "scroll",
        function () {
            handleNavVisibility();
            handleHeroFade();
        },
        { passive: true },
    );

    /* ===== Particle Field ===== */
    (function initParticles() {
        const canvas = document.getElementById("heroParticles");
        const ctx = canvas.getContext("2d");
        const outlineCanvas = document.getElementById("heroOutline");
        const outlineCtx = outlineCanvas ? outlineCanvas.getContext("2d") : null;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const TAU = Math.PI * 2;

        /* ─── SÄÄDETTÄVÄT ASETUKSET ─── */

        /* Partikkelien väri (R, G, B) */
        const COLOR_R = 108;
        const COLOR_G = 135;
        const COLOR_B = 255;

        /* Partikkelien kirkkaus & koko */
        const PARTICLE_DENSITY = 0.00015; /* Partikkeleita per neliöpikseli */
        const PARTICLE_COUNT = Math.round(
            Math.max(30, Math.min(400, window.innerWidth * window.innerHeight * PARTICLE_DENSITY)),
        );
        const SIZE_MIN = 0.6; /* Pienin partikkeli (px) */
        const SIZE_MAX = 2.4; /* Suurin partikkeli (px) */
        const ALPHA_MIN = 0.1; /* Himmeimmät partikkelit (0–1) */
        const ALPHA_MAX = 1.0; /* Kirkkaimmat partikkelit (0–1) */

        /* Yhdistysviivat */
        const LINE_MAX_DIST = 100; /* Max etäisyys viivoille (px) */
        const LINE_OPACITY = 0.0; /* Viivojen kirkkaus (0–1) */
        const LINE_WIDTH = 0.5; /* Viivojen paksuus (px) */

        /* Liike */
        const MOUSE_RADIUS_FRAC = 0.07; /* Kursorin vaikutusalue (osuus näytön lävistäjästä) */
        const REPULSION = 3000; /* Kursorin työntövoima */
        const DRIFT_SPEED = 0.05; /* Leijunnan maksiminopeus */
        const MAX_SPEED = 0.8; /* Absoluuttinen nopeusraja */
        const FRICTION = 0.98; /* Kitka (0.9–0.99, suurempi = liukkaampi) */
        const LOGO_REPULSION = 1.5; /* Logon hylkimisvoima — pitää partikkelit poissa logosta */
        const LOGO_MARGIN = 25; /* Tyhjä väli logon ympärillä (px) — kapea, siisti reuna */
        const LOGO_MARGIN_SAMPLE_STEP = 4; /* Kuinka harvasti margin-alue tarkistetaan */
        const LOGO_ATTRACT = 0.035; /* Logon vetovoima — vetää partikkelit "kiertoradalle" */
        const LOGO_ATTRACT_RADIUS_FRAC = 0.15; /* Vetovoiman kantama (osuus näytön lävistäjästä) */

        /* Isotypen dynaaminen outline — lasketaan koko reunalle */
        const OUTLINE_SEGMENTS = 220; /* Kuinka tiheästi reuna näytteistetään */
        const OUTLINE_MAX_ALPHA = 1; /* Maksimikirkkaus (0–1) */
        const OUTLINE_THRESHOLD = 0.82; /* Kuinka paljon paikallista energiaa vaaditaan */
        const OUTLINE_SMOOTHING = 0.28; /* Kuinka nopeasti segmentit reagoivat */
        const OUTLINE_WIDTH = 1.45; /* Outlinen peruspaksuus (px) */
        const OUTLINE_BLUR = 7; /* Pehmeän hehkun määrä */
        const OUTLINE_INFLUENCE_RADIUS_FRAC = 0.038; /* Partikkelien vaikutusetäisyys */
        const OUTLINE_ENERGY_SCALE = 2.4; /* Kuinka paljon yli odotetun paikallistiheyden vaaditaan */
        const OUTLINE_CONTRAST = 2.35; /* Kuinka jyrkästi kirkkauserot kasvavat */
        const OUTLINE_STRAIGHT_EDGE_RATIO = 2.4; /* Milloin tangentti tulkitaan suoraksi reunaksi */
        const OUTLINE_STRAIGHTEN_STRENGTH = 0.7; /* Kuinka vahvasti suoria reunoja oikaistaan */
        const OUTLINE_MIN_ALPHA = 0.02; /* Piirtoraja hyvin himmeille segmenteille */

        /* Dynaamiset arvot — lasketaan uudelleen resize():ssä */
        let MOUSE_RADIUS = 180;
        let LOGO_ATTRACT_RADIUS = 50;
        let OUTLINE_INFLUENCE_RADIUS = 42;

        /* ─── /ASETUKSET ─── */

        let particles = [];
        const mouse = { x: -9999, y: -9999 };
        let animId = null;
        let w, h;
        let outlinePoints = [];
        let outlineRadii = [];
        let outlineLevels = [];
        let outlineEnergyBuffer = new Float32Array(0);
        let outlineSmoothedBuffer = new Float32Array(0);
        let outlineMinRadius = 0;
        let outlineMaxRadius = 0;

        /* Logo collision mask */
        const maskCanvas = document.createElement("canvas");
        const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
        let maskData = null;
        let logoOffX = 0,
            logoOffY = 0,
            logoW = 0,
            logoH = 0;
        let isoCX = 0,
            isoCY = 0; /* Isotype center in hero coordinates */
        let isoRx = 0,
            isoRy = 0,
            isoW = 0,
            isoH = 0; /* Isotypen mitat hero-koordinaateissa */

        const maskSvgTemplateEl = document.getElementById("heroIsotypeMaskTemplate");
        const maskImg = new Image();
        let maskReady = false;

        function drawFallbackMask(rx, ry, iw, ih) {
            const fallbackCorner = Math.min(iw, ih) * 0.22;
            maskCtx.clearRect(0, 0, logoW, logoH);
            maskCtx.beginPath();
            maskCtx.roundRect(rx, ry, iw, ih, fallbackCorner);
            maskCtx.fillStyle = "white";
            maskCtx.fill();
            maskData = maskCtx.getImageData(0, 0, logoW, logoH).data;
        }

        function transformPoint(point, matrix) {
            return {
                x: matrix.a * point.x + matrix.c * point.y + matrix.e,
                y: matrix.b * point.x + matrix.d * point.y + matrix.f,
            };
        }

        function buildOutlineContour() {
            if (!maskData || !logoW || !logoH) {
                outlinePoints = [];
                outlineRadii = [];
                outlineLevels = [];
                outlineEnergyBuffer = new Float32Array(0);
                outlineSmoothedBuffer = new Float32Array(0);
                outlineMinRadius = 0;
                outlineMaxRadius = 0;
                return;
            }

            const bins = new Array(OUTLINE_SEGMENTS).fill(null);
            const localCenterX = isoCX - logoOffX;
            const localCenterY = isoCY - logoOffY;

            for (let y = 1; y < logoH - 1; y++) {
                for (let x = 1; x < logoW - 1; x++) {
                    const alphaIndex = (y * logoW + x) * 4 + 3;
                    if (maskData[alphaIndex] <= 128) continue;

                    const left = maskData[(y * logoW + (x - 1)) * 4 + 3] > 128;
                    const right = maskData[(y * logoW + (x + 1)) * 4 + 3] > 128;
                    const up = maskData[((y - 1) * logoW + x) * 4 + 3] > 128;
                    const down = maskData[((y + 1) * logoW + x) * 4 + 3] > 128;
                    if (left && right && up && down) continue;

                    const dx = x - localCenterX;
                    const dy = y - localCenterY;
                    const distSq = dx * dx + dy * dy;
                    let angle = Math.atan2(dy, dx);
                    if (angle < 0) angle += TAU;
                    const binIndex =
                        Math.floor((angle / TAU) * OUTLINE_SEGMENTS) % OUTLINE_SEGMENTS;
                    const current = bins[binIndex];

                    if (!current || distSq > current.distSq) {
                        bins[binIndex] = {
                            x: logoOffX + x + 0.5,
                            y: logoOffY + y + 0.5,
                            distSq: distSq,
                        };
                    }
                }
            }

            const firstIndex = bins.findIndex(function (point) {
                return !!point;
            });
            if (firstIndex === -1) {
                outlinePoints = [];
                outlineRadii = [];
                outlineLevels = [];
                outlineEnergyBuffer = new Float32Array(0);
                outlineSmoothedBuffer = new Float32Array(0);
                outlineMinRadius = 0;
                outlineMaxRadius = 0;
                return;
            }

            const filled = bins.map(function (point) {
                return point ? { x: point.x, y: point.y } : null;
            });

            for (let i = 0; i < filled.length; i++) {
                if (filled[i]) continue;

                let prevIndex = (i - 1 + filled.length) % filled.length;
                while (!filled[prevIndex])
                    prevIndex = (prevIndex - 1 + filled.length) % filled.length;

                let nextIndex = (i + 1) % filled.length;
                while (!filled[nextIndex]) nextIndex = (nextIndex + 1) % filled.length;

                const prevPoint = filled[prevIndex];
                const nextPoint = filled[nextIndex];
                const span =
                    nextIndex >= prevIndex
                        ? nextIndex - prevIndex
                        : nextIndex + filled.length - prevIndex;
                const offset = i >= prevIndex ? i - prevIndex : i + filled.length - prevIndex;
                const t = span ? offset / span : 0;

                filled[i] = {
                    x: prevPoint.x + (nextPoint.x - prevPoint.x) * t,
                    y: prevPoint.y + (nextPoint.y - prevPoint.y) * t,
                };
            }

            let smoothed = filled;
            for (let pass = 0; pass < 2; pass++) {
                smoothed = smoothed.map(function (point, index, points) {
                    const prev = points[(index - 1 + points.length) % points.length];
                    const next = points[(index + 1) % points.length];
                    return {
                        x: (prev.x + point.x * 2 + next.x) / 4,
                        y: (prev.y + point.y * 2 + next.y) / 4,
                    };
                });
            }

            smoothed = smoothed.map(function (point, index, points) {
                const prev2 = points[(index - 2 + points.length) % points.length];
                const prev = points[(index - 1 + points.length) % points.length];
                const next = points[(index + 1) % points.length];
                const next2 = points[(index + 2) % points.length];
                const tangentX = next2.x - prev2.x;
                const tangentY = next2.y - prev2.y;
                const absTangentX = Math.abs(tangentX);
                const absTangentY = Math.abs(tangentY);

                if (absTangentX > absTangentY * OUTLINE_STRAIGHT_EDGE_RATIO) {
                    const targetY = (prev2.y + prev.y + point.y * 2 + next.y + next2.y) / 6;
                    return {
                        x: point.x,
                        y:
                            point.y * (1 - OUTLINE_STRAIGHTEN_STRENGTH) +
                            targetY * OUTLINE_STRAIGHTEN_STRENGTH,
                    };
                }

                if (absTangentY > absTangentX * OUTLINE_STRAIGHT_EDGE_RATIO) {
                    const targetX = (prev2.x + prev.x + point.x * 2 + next.x + next2.x) / 6;
                    return {
                        x:
                            point.x * (1 - OUTLINE_STRAIGHTEN_STRENGTH) +
                            targetX * OUTLINE_STRAIGHTEN_STRENGTH,
                        y: point.y,
                    };
                }

                return point;
            });

            outlinePoints = smoothed;
            outlineRadii = outlinePoints.map(function (point) {
                const dx = point.x - isoCX;
                const dy = point.y - isoCY;
                return Math.sqrt(dx * dx + dy * dy);
            });
            outlineLevels = new Float32Array(outlinePoints.length);
            outlineEnergyBuffer = new Float32Array(outlinePoints.length);
            outlineSmoothedBuffer = new Float32Array(outlinePoints.length);
            outlineMinRadius = Math.min.apply(null, outlineRadii);
            outlineMaxRadius = Math.max.apply(null, outlineRadii);
        }

        function drawOutline() {
            if (!outlineCtx) return;

            outlineCtx.clearRect(0, 0, w, h);
            if (outlinePoints.length < 2) return;

            const influenceRadiusSq = OUTLINE_INFLUENCE_RADIUS * OUTLINE_INFLUENCE_RADIUS;
            const particleDensity = particles.length / Math.max(1, w * h);
            const expectedLocalEnergy =
                Math.max(0.0001, (particleDensity * Math.PI * influenceRadiusSq) / 3) *
                OUTLINE_ENERGY_SCALE;
            const localLevels = outlineEnergyBuffer;
            const smoothedLevels = outlineSmoothedBuffer;
            localLevels.fill(0);
            let peakLevel = 0;

            for (let i = 0; i < particles.length; i++) {
                const particle = particles[i];
                const centerDx = particle.x - isoCX;
                const centerDy = particle.y - isoCY;
                const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

                if (
                    centerDist < outlineMinRadius - OUTLINE_INFLUENCE_RADIUS ||
                    centerDist > outlineMaxRadius + OUTLINE_INFLUENCE_RADIUS
                ) {
                    continue;
                }

                let angle = Math.atan2(centerDy, centerDx);
                if (angle < 0) angle += TAU;

                const centerIndex =
                    Math.floor((angle / TAU) * outlinePoints.length) % outlinePoints.length;
                const safeCenterDist = Math.max(centerDist, OUTLINE_INFLUENCE_RADIUS);
                const angularReach = Math.asin(
                    Math.min(0.999, OUTLINE_INFLUENCE_RADIUS / safeCenterDist),
                );
                const segmentReach = Math.max(
                    1,
                    Math.ceil((angularReach / TAU) * outlinePoints.length) + 1,
                );

                for (let offset = -segmentReach; offset <= segmentReach; offset++) {
                    const index =
                        (centerIndex + offset + outlinePoints.length) % outlinePoints.length;
                    const point = outlinePoints[index];
                    const dx = particle.x - point.x;
                    const dy = particle.y - point.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= influenceRadiusSq) continue;

                    const dist = Math.sqrt(distSq);
                    localLevels[index] += 1 - dist / OUTLINE_INFLUENCE_RADIUS;
                }
            }

            for (let i = 0; i < outlinePoints.length; i++) {
                const normalized = Math.min(1, localLevels[i] / expectedLocalEnergy);
                const targetLevel =
                    normalized > OUTLINE_THRESHOLD
                        ? Math.pow(
                              Math.min(
                                  1,
                                  (normalized - OUTLINE_THRESHOLD) / (1 - OUTLINE_THRESHOLD),
                              ),
                              OUTLINE_CONTRAST,
                          )
                        : 0;

                outlineLevels[i] += (targetLevel - outlineLevels[i]) * OUTLINE_SMOOTHING;
                if (outlineLevels[i] < 0.005) outlineLevels[i] = 0;
                localLevels[i] = outlineLevels[i];
            }

            for (let i = 0; i < localLevels.length; i++) {
                const prev = localLevels[(i - 1 + localLevels.length) % localLevels.length];
                const next = localLevels[(i + 1) % localLevels.length];
                const smoothedLevel = (prev + localLevels[i] * 2 + next) / 4;
                smoothedLevels[i] = smoothedLevel;
                if (smoothedLevel > peakLevel) peakLevel = smoothedLevel;
            }

            if (peakLevel < OUTLINE_MIN_ALPHA) return;

            outlineCtx.lineCap = "round";
            outlineCtx.lineJoin = "round";

            for (let i = 0; i < outlinePoints.length; i++) {
                const nextIndex = (i + 1) % outlinePoints.length;
                const alpha =
                    (smoothedLevels[i] + smoothedLevels[nextIndex]) * 0.5 * OUTLINE_MAX_ALPHA;
                if (alpha < OUTLINE_MIN_ALPHA) continue;

                outlineCtx.beginPath();
                outlineCtx.moveTo(outlinePoints[i].x, outlinePoints[i].y);
                outlineCtx.lineTo(outlinePoints[nextIndex].x, outlinePoints[nextIndex].y);
                outlineCtx.lineWidth = OUTLINE_WIDTH + alpha * 1.8;
                outlineCtx.strokeStyle = rgba(alpha);
                outlineCtx.shadowBlur = OUTLINE_BLUR + alpha * 14;
                outlineCtx.shadowColor = rgba(Math.min(1, alpha * 0.95));
                outlineCtx.stroke();
            }

            outlineCtx.shadowBlur = 0;
        }

        function getIsotypeGeometry(logoEl) {
            const viewBox = logoEl.viewBox && logoEl.viewBox.baseVal;
            const outerGroup = logoEl.querySelector("g");
            const isoGroup = logoEl.querySelector("g > g");

            if (!viewBox || !outerGroup || !isoGroup || !isoGroup.getBBox) return null;

            const outerMatrix = outerGroup.transform.baseVal.consolidate();
            const isoMatrix = isoGroup.transform.baseVal.consolidate();
            const outer = outerMatrix ? outerMatrix.matrix : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            const inner = isoMatrix ? isoMatrix.matrix : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            const box = isoGroup.getBBox();

            const corners = [
                { x: box.x, y: box.y },
                { x: box.x + box.width, y: box.y },
                { x: box.x, y: box.y + box.height },
                { x: box.x + box.width, y: box.y + box.height },
            ].map(function (point) {
                return transformPoint(transformPoint(point, inner), outer);
            });

            const xs = corners.map(function (point) {
                return point.x;
            });
            const ys = corners.map(function (point) {
                return point.y;
            });

            return {
                viewBox: viewBox,
                box: {
                    x: Math.min.apply(null, xs),
                    y: Math.min.apply(null, ys),
                    width: Math.max.apply(null, xs) - Math.min.apply(null, xs),
                    height: Math.max.apply(null, ys) - Math.min.apply(null, ys),
                },
            };
        }

        maskImg.onload = function () {
            maskReady = true;
            buildLogoMask();
        };
        maskImg.onerror = function () {
            maskReady = false;
            console.warn("hero particle mask could not be loaded; using fallback mask");
            buildLogoMask();
        };
        if (maskSvgTemplateEl && maskSvgTemplateEl.content) {
            const maskSvgEl = maskSvgTemplateEl.content.querySelector("svg");
            const maskClone = maskSvgEl ? maskSvgEl.cloneNode(true) : null;
            if (!maskClone) {
                console.warn("hero particle mask template is empty; using fallback mask");
            } else {
                maskClone.removeAttribute("id");
                maskClone.removeAttribute("class");
                maskClone.setAttribute("width", maskClone.getAttribute("viewBox").split(" ")[2]);
                maskClone.setAttribute("height", maskClone.getAttribute("viewBox").split(" ")[3]);
                const maskSvgStr = new XMLSerializer().serializeToString(maskClone);
                maskImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(maskSvgStr);
            }
        } else {
            console.warn("hero particle mask template is missing; using fallback mask");
        }

        function buildLogoMask() {
            const logoEl = hero.querySelector(".hero-logo");
            if (!logoEl) return;
            const geometry = getIsotypeGeometry(logoEl);
            if (!geometry) return;

            const heroRect = hero.getBoundingClientRect();

            /* Use the full logo area for the mask canvas */
            const logoRect2 = logoEl.getBoundingClientRect();
            logoOffX = logoRect2.left - heroRect.left;
            logoOffY = logoRect2.top - heroRect.top;
            logoW = Math.round(logoRect2.width);
            logoH = Math.round(logoRect2.height);

            if (logoW === 0 || logoH === 0) return;

            maskCanvas.width = logoW;
            maskCanvas.height = logoH;
            maskCtx.clearRect(0, 0, logoW, logoH);

            const scaleX = logoRect2.width / geometry.viewBox.width;
            const scaleY = logoRect2.height / geometry.viewBox.height;
            const rx = (geometry.box.x - geometry.viewBox.x) * scaleX;
            const ry = (geometry.box.y - geometry.viewBox.y) * scaleY;
            const iw = geometry.box.width * scaleX;
            const ih = geometry.box.height * scaleY;

            isoCX = logoOffX + rx + iw / 2;
            isoCY = logoOffY + ry + ih / 2;

            /* Tallenna isotypen mitat reunahehkua varten (hero-koordinaatit) */
            isoRx = logoOffX + rx;
            isoRy = logoOffY + ry;
            isoW = iw;
            isoH = ih;

            if (maskReady) {
                maskCtx.drawImage(maskImg, rx, ry, iw, ih);
                maskData = maskCtx.getImageData(0, 0, logoW, logoH).data;
            } else {
                drawFallbackMask(rx, ry, iw, ih);
            }

            buildOutlineContour();
        }

        function isInsideLogo(px, py) {
            if (!maskData) return false;
            const lx = Math.round(px - logoOffX);
            const ly = Math.round(py - logoOffY);
            if (lx < 0 || ly < 0 || lx >= logoW || ly >= logoH) return false;
            /* Check alpha channel of the mask pixel */
            return maskData[(ly * logoW + lx) * 4 + 3] > 128;
        }

        function estimateLogoMarginFade(px, py, ndx, ndy) {
            const coarseStep = Math.max(2, LOGO_MARGIN_SAMPLE_STEP);
            let coarseHit = 0;

            for (let s = coarseStep; s <= LOGO_MARGIN; s += coarseStep) {
                if (isInsideLogo(px - ndx * s, py - ndy * s)) {
                    coarseHit = s;
                    break;
                }
            }

            if (!coarseHit && isInsideLogo(px - ndx * LOGO_MARGIN, py - ndy * LOGO_MARGIN)) {
                coarseHit = LOGO_MARGIN;
            }

            if (!coarseHit) return 0;

            const start = Math.max(1, coarseHit - coarseStep + 1);
            let hitStep = coarseHit;
            for (let s = start; s <= coarseHit; s++) {
                if (isInsideLogo(px - ndx * s, py - ndy * s)) {
                    hitStep = s;
                    break;
                }
            }

            return (LOGO_MARGIN - hitStep) / LOGO_MARGIN;
        }

        function rgba(a) {
            return "rgba(" + COLOR_R + ", " + COLOR_G + ", " + COLOR_B + ", " + a + ")";
        }

        function resize() {
            w = hero.offsetWidth;
            h = hero.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (outlineCanvas && outlineCtx) {
                outlineCanvas.width = w * dpr;
                outlineCanvas.height = h * dpr;
                outlineCanvas.style.width = w + "px";
                outlineCanvas.style.height = h + "px";
                outlineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            /* Skaalaa etäisyysparametrit näytön lävistäjän mukaan */
            const diag = Math.sqrt(w * w + h * h);
            MOUSE_RADIUS = Math.round(diag * MOUSE_RADIUS_FRAC);
            LOGO_ATTRACT_RADIUS = Math.round(diag * LOGO_ATTRACT_RADIUS_FRAC);
            OUTLINE_INFLUENCE_RADIUS = Math.max(
                22,
                Math.round(diag * OUTLINE_INFLUENCE_RADIUS_FRAC),
            );
        }

        function createParticles() {
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * DRIFT_SPEED + 0.01;
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * (SIZE_MAX - SIZE_MIN) + SIZE_MIN,
                    alpha: Math.random() * (ALPHA_MAX - ALPHA_MIN) + ALPHA_MIN,
                    driftPhase: Math.random() * Math.PI * 2,
                    driftAmpX: Math.random() * 0.008 + 0.003,
                    driftAmpY: Math.random() * 0.006 + 0.002,
                    driftFreq: Math.random() * 0.003 + 0.001,
                });
            }
        }

        let tick = 0;

        function draw() {
            ctx.clearRect(0, 0, w, h);
            tick++;
            const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS;
            const logoAttractRadiusSq = LOGO_ATTRACT_RADIUS * LOGO_ATTRACT_RADIUS;
            const logoMarginOuterRadius = outlineMaxRadius + LOGO_MARGIN;
            const logoMarginOuterRadiusSq = logoMarginOuterRadius * logoMarginOuterRadius;

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                /* Gentle wandering drift (like dust floating in air) */
                p.vx += Math.sin(tick * p.driftFreq + p.driftPhase) * p.driftAmpX;
                p.vy += Math.cos(tick * p.driftFreq * 0.8 + p.driftPhase) * p.driftAmpY;

                /* Repulsion from cursor — soft push */
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < mouseRadiusSq && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const force = REPULSION / distSq;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                /* Repulsion from isotype shape + margin zone */
                const ldx = p.x - isoCX;
                const ldy = p.y - isoCY;
                const lDistSq = ldx * ldx + ldy * ldy;
                const lDist = Math.sqrt(lDistSq) || 1;
                const ndx = ldx / lDist;
                const ndy = ldy / lDist;
                const insideLogo = isInsideLogo(p.x, p.y);

                if (insideLogo) {
                    /* Inside logo — full push out */
                    p.vx += ndx * LOGO_REPULSION;
                    p.vy += ndy * LOGO_REPULSION;
                } else if (LOGO_MARGIN > 0 && lDistSq < logoMarginOuterRadiusSq) {
                    /* Estimate margin depth with a coarse-to-fine lookup instead of per-pixel sampling */
                    const fade = estimateLogoMarginFade(p.x, p.y, ndx, ndy);
                    if (fade > 0) {
                        const force = LOGO_REPULSION * fade * fade;
                        p.vx += ndx * force;
                        p.vy += ndy * force;
                    }
                }

                /* Gentle gravity pull toward logo from distance */
                if (!insideLogo && lDist > LOGO_MARGIN && lDistSq < logoAttractRadiusSq) {
                    const attractFade = 1 - lDist / LOGO_ATTRACT_RADIUS;
                    p.vx -= ndx * LOGO_ATTRACT * attractFade;
                    p.vy -= ndy * LOGO_ATTRACT * attractFade;
                }

                /* Friction — keeps speeds from accumulating */
                p.vx *= FRICTION;
                p.vy *= FRICTION;

                /* Clamp max speed so particles stay dust-like */
                const speedSq = p.vx * p.vx + p.vy * p.vy;
                if (speedSq > MAX_SPEED * MAX_SPEED) {
                    const speed = Math.sqrt(speedSq);
                    p.vx = (p.vx / speed) * MAX_SPEED;
                    p.vy = (p.vy / speed) * MAX_SPEED;
                }

                p.x += p.vx;
                p.y += p.vy;

                /* Wrap around edges with margin */
                const margin = 20;
                if (p.x < -margin) p.x = w + margin;
                else if (p.x > w + margin) p.x = -margin;
                if (p.y < -margin) p.y = h + margin;
                else if (p.y > h + margin) p.y = -margin;

                /* Draw particle */
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = rgba(p.alpha);
                ctx.fill();
            }

            drawOutline();

            /* Faint connection lines between nearby particles */
            if (LINE_OPACITY > 0) {
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        const dx = particles[i].x - particles[j].x;
                        const dy = particles[i].y - particles[j].y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < LINE_MAX_DIST) {
                            ctx.beginPath();
                            ctx.moveTo(particles[i].x, particles[i].y);
                            ctx.lineTo(particles[j].x, particles[j].y);
                            ctx.strokeStyle = rgba((1 - dist / LINE_MAX_DIST) * LINE_OPACITY);
                            ctx.lineWidth = LINE_WIDTH;
                            ctx.stroke();
                        }
                    }
                }
            }

            animId = requestAnimationFrame(draw);
        }

        hero.addEventListener(
            "mousemove",
            function (e) {
                const rect = hero.getBoundingClientRect();
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            },
            { passive: true },
        );

        hero.addEventListener("mouseleave", function () {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        /* Pause when hero is not visible or tab is hidden */
        let heroVisible = true;
        let tabVisible = true;

        function updateAnimLoop() {
            if (heroVisible && tabVisible) {
                if (!animId) animId = requestAnimationFrame(draw);
            } else {
                if (animId) {
                    cancelAnimationFrame(animId);
                    animId = null;
                }
            }
        }

        const particleObserver = new IntersectionObserver(
            function (entries) {
                heroVisible = entries[0].isIntersecting;
                updateAnimLoop();
            },
            { threshold: 0 },
        );
        particleObserver.observe(hero);

        document.addEventListener("visibilitychange", function () {
            tabVisible = !document.hidden;
            updateAnimLoop();
        });

        resize();
        createParticles();
        buildLogoMask();
        animId = requestAnimationFrame(draw);

        window.addEventListener(
            "resize",
            function () {
                const oldW = w;
                const oldH = h;
                resize();
                /* Scale particle positions to new dimensions instead of resetting */
                const scaleX = w / (oldW || 1);
                const scaleY = h / (oldH || 1);
                for (let i = 0; i < particles.length; i++) {
                    particles[i].x *= scaleX;
                    particles[i].y *= scaleY;
                }
                buildLogoMask();
            },
            { passive: true },
        );
    })();

    /* ===== Chevron click ===== */
    const chevron = document.getElementById("heroChevron");
    function scrollToContent() {
        const target = document.getElementById("tietoa");
        if (target) target.scrollIntoView({ behavior: "smooth" });
    }
    chevron.addEventListener("click", scrollToContent);
    chevron.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            scrollToContent();
        }
    });

    /* ===== Chevron hint appear ===== */
    const hint = document.querySelector(".hero-chevron-hint");
    if (hint) {
        setTimeout(function () {
            hint.style.opacity = "0.7";
            hint.style.transform = "translateY(0)";
        }, 2500);
    }

    /* ===== Mobile menu ===== */
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobileMenu");
    let menuOpen = false;

    function toggleMenu() {
        menuOpen = !menuOpen;
        hamburger.classList.toggle("active", menuOpen);
        hamburger.setAttribute("aria-expanded", menuOpen);
        mobileMenu.classList.toggle("open", menuOpen);
        mobileMenu.setAttribute("aria-hidden", !menuOpen);
        document.body.style.overflow = menuOpen ? "hidden" : "";
    }

    hamburger.addEventListener("click", toggleMenu);

    mobileMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            if (menuOpen) toggleMenu();
        });
    });

    /* ===== Product switcher ===== */
    const productSwitchButtons = document.querySelectorAll(".product-switch-btn");
    const productBlocks = document.querySelectorAll(".product-block[data-product]");

    function productFromHash(hash) {
        if (hash === "#flow") return "flow";
        if (hash === "#erp") return "erp";
        if (hash === "#shift") return "shift";
        return null;
    }

    function setActiveProduct(product) {
        productSwitchButtons.forEach(function (btn) {
            const active = btn.getAttribute("data-product") === product;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });

        const currentLightbox = document.getElementById("lightbox");
        if (product !== "shift" && currentLightbox && currentLightbox.classList.contains("open")) {
            currentLightbox.classList.remove("open");
            currentLightbox.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }

        productBlocks.forEach(function (block) {
            const active = block.getAttribute("data-product") === product;
            block.classList.toggle("product-hidden", !active);
            block.setAttribute("aria-hidden", active ? "false" : "true");
        });
    }

    productSwitchButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            const product = btn.getAttribute("data-product") || "shift";
            if (location.hash !== "#" + product) {
                location.hash = product;
            } else {
                setActiveProduct(product);
            }
        });
    });

    window.addEventListener("hashchange", function () {
        const product = productFromHash(window.location.hash);
        if (product) setActiveProduct(product);
    });

    setActiveProduct(productFromHash(window.location.hash) || "shift");

    /* ===== Tabs (crossfade) ===== */
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");

    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            const tabId = btn.getAttribute("data-tab");
            const targetPanel = document.getElementById("panel-" + tabId);
            const currentActive = document.querySelector(".tab-panel.active");

            if (targetPanel === currentActive) return;

            tabButtons.forEach(function (b) {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");

            if (currentActive) currentActive.classList.remove("active");
            if (targetPanel) targetPanel.classList.add("active");
        });
    });

    /* ===== Lightbox ===== */
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = lightbox.querySelector("img");
    const lightboxClose = lightbox.querySelector(".lightbox-close");

    document.querySelectorAll(".tab-image-wrapper").forEach(function (wrapper) {
        wrapper.addEventListener("click", function () {
            const img = wrapper.querySelector("img");
            if (!img) return;
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
            lightbox.classList.add("open");
            lightbox.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        });
    });

    function closeLightbox() {
        lightbox.classList.remove("open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && lightbox.classList.contains("open")) closeLightbox();
    });

    /* ===== Pricing calculator ===== */
    const TIERS = [
        { min: 1, max: 20, rate: 3.9 },
        { min: 21, max: 75, rate: 2.9 },
        { min: 76, max: Infinity, rate: 1.9 },
    ];
    const MIN_FEE = 29;
    const KIOSK_PRICE = 35;
    let empCount = 10;
    let kioskCount = 0;

    const empSlider = document.getElementById("empSlider");
    const empDisplay = document.getElementById("empDisplay");
    const kioskCountEl = document.getElementById("kioskCount");
    const calcTotalEl = document.getElementById("calcTotal");
    const calcBreakdownEl = document.getElementById("calcBreakdown");
    const calcRateValueEl = document.getElementById("calcRateValue");
    const tierEls = [
        document.getElementById("tier-1"),
        document.getElementById("tier-2"),
        document.getElementById("tier-3"),
    ];

    /* Nollaa laskuri sivun latautuessa (selain muistaa sliderin tilan muuten) */
    empSlider.value = empCount;

    function fmt(n) {
        return n.toFixed(2).replace(".", ",").replace(/,00$/, "") + " €";
    }

    function calcEmployeeCost(n) {
        let cost = 0;
        for (let i = 0; i < TIERS.length; i++) {
            if (n <= 0) break;
            const inTier = Math.min(n, TIERS[i].max - TIERS[i].min + 1);
            cost += inTier * TIERS[i].rate;
            n -= inTier;
        }
        return cost;
    }

    function activeTierIndex(n) {
        if (n <= 20) return 0;
        if (n <= 75) return 1;
        return 2;
    }

    function buildBreakdown(n, kiosks) {
        const parts = [];
        let remaining = n;
        for (let i = 0; i < TIERS.length; i++) {
            if (remaining <= 0) break;
            const inTier = Math.min(remaining, TIERS[i].max - TIERS[i].min + 1);
            parts.push(inTier + " hlö × " + TIERS[i].rate.toFixed(2).replace(".", ",") + " €");
            remaining -= inTier;
        }
        if (kiosks > 0) parts.push(kiosks + " pääte × " + KIOSK_PRICE + " €");
        return parts.join(" + ");
    }

    function updateCalc() {
        empDisplay.innerHTML = empCount + " <span>hlö</span>";
        kioskCountEl.textContent = kioskCount;

        const empCost = Math.max(calcEmployeeCost(empCount), MIN_FEE);
        const total = empCost + kioskCount * KIOSK_PRICE;

        calcTotalEl.textContent = fmt(total);
        calcBreakdownEl.textContent = buildBreakdown(empCount, kioskCount);

        /* Update compact per-user rate */
        const activeRate = TIERS[activeTierIndex(empCount)].rate;
        if (calcRateValueEl) {
            calcRateValueEl.textContent = activeRate.toFixed(2).replace(".", ",");
        }

        /* Sync summary text for contact form */
        const summaryEl = document.getElementById("calcSummaryText");
        if (summaryEl) {
            const lines = ["Henkilöt: " + empCount + " hlö"];
            if (kioskCount > 0) lines.push("Leimauspäätteet: " + kioskCount + " kpl");
            lines.push("Erittely: " + buildBreakdown(empCount, kioskCount));
            lines.push("Yhteensä: " + fmt(total) + " / kk (alv 0 %)");
            summaryEl.textContent = lines.join(" | ");
        }

        const active = activeTierIndex(empCount);
        tierEls.forEach(function (el, i) {
            el.classList.toggle("active", i === active);
        });

        /* Range fill track */
        const pct = ((empCount - 1) / 199) * 100;
        empSlider.style.background =
            "linear-gradient(to right, var(--color-accent) " +
            pct +
            "%, rgba(255,255,255,0.1) " +
            pct +
            "%)";
    }

    empSlider.addEventListener("input", function () {
        empCount = parseInt(this.value, 10);
        updateCalc();
    });

    document.getElementById("kioskMinus").addEventListener("click", function () {
        if (kioskCount > 0) {
            kioskCount--;
            updateCalc();
        }
    });
    document.getElementById("kioskPlus").addEventListener("click", function () {
        if (kioskCount < 50) {
            kioskCount++;
            updateCalc();
        }
    });

    updateCalc();

    /* ===== Scroll animations ===== */
    const animElements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    animElements.forEach(function (el) {
        observer.observe(el);
    });

    /* ===== Contact form (Web3Forms) ===== */
    const contactForm = document.getElementById("contactForm");
    const submitBtn = contactForm.querySelector("button[type='submit']");

    /* Nollaa checkbox sivun latautuessa (selain muistaa tilan muuten) */
    const includeCalcInit = document.getElementById("includeCalc");
    includeCalcInit.checked = false;
    document.getElementById("calcAttachPreview").style.display = "none";

    const interestMap = {
        shift: document.getElementById("interestShift"),
        flow: document.getElementById("interestFlow"),
        erp: document.getElementById("interestErp"),
    };
    const productInterestSummary = document.getElementById("productInterestSummary");

    function syncInterestSummary() {
        if (!productInterestSummary) return;
        const values = Object.keys(interestMap)
            .map(function (key) {
                const checkbox = interestMap[key];
                return checkbox && checkbox.checked ? checkbox.value : null;
            })
            .filter(Boolean);
        productInterestSummary.value = values.join(", ");
    }

    function markProductInterest(productKey) {
        const checkbox = interestMap[productKey];
        if (!checkbox) return;
        checkbox.checked = true;
        syncInterestSummary();
    }

    Object.keys(interestMap).forEach(function (key) {
        const checkbox = interestMap[key];
        if (!checkbox) return;
        checkbox.addEventListener("change", syncInterestSummary);
    });

    document.querySelectorAll(".js-product-contact").forEach(function (link) {
        link.addEventListener("click", function (e) {
            const interest = link.getAttribute("data-interest");
            if (interest) markProductInterest(interest);
            e.preventDefault();
            document.getElementById("contactForm").scrollIntoView({ behavior: "smooth" });
        });
    });

    syncInterestSummary();

    /* Kysy tarjous -nappi laskurissa */
    document.getElementById("calcQuoteBtn").addEventListener("click", function () {
        const checkbox = document.getElementById("includeCalc");
        checkbox.checked = true;
        markProductInterest("shift");
        document.getElementById("calcAttachPreview").style.display = "block";
        document.getElementById("contactForm").scrollIntoView({ behavior: "smooth" });
    });

    /* Checkbox toggle */
    document.getElementById("includeCalc").addEventListener("change", function () {
        document.getElementById("calcAttachPreview").style.display = this.checked
            ? "block"
            : "none";
    });

    contactForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        /* Estä tuplalähetys */
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;

        const name = document.getElementById("contact-name").value.trim();
        const email = document.getElementById("contact-email").value.trim();
        const message = document.getElementById("contact-message").value.trim();
        const nameError = document.getElementById("nameError");
        const emailError = document.getElementById("emailError");
        const messageError = document.getElementById("messageError");
        const formMessage = document.getElementById("formMessage");

        /* Piilota aiemmat viestit */
        nameError.textContent = "";
        emailError.textContent = "";
        messageError.textContent = "";
        formMessage.className = "form-message";
        formMessage.style.display = "none";

        /* Validoi kaikki kentät kerralla */
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let valid = true;

        if (!name) {
            nameError.textContent = "Syötä nimesi.";
            valid = false;
        }
        if (!email) {
            emailError.textContent = "Syötä sähköpostiosoitteesi.";
            valid = false;
        } else if (!emailRegex.test(email)) {
            emailError.textContent = "Syötä kelvollinen sähköpostiosoite.";
            valid = false;
        }
        if (!message) {
            messageError.textContent = "Kirjoita viesti.";
            valid = false;
        }

        if (!valid) {
            submitBtn.disabled = false;
            return;
        }

        /* Aseta replyto dynaamisesti ennen lähetystä */
        document.getElementById("replytoField").value = email;

        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Lähetetään...";

        try {
            const formData = new FormData(contactForm);
            /* Liitä laskuridata vain jos checkbox on päällä */
            const includeCalc = document.getElementById("includeCalc");
            if (includeCalc.checked) {
                formData.append(
                    "Laskurin_arvio",
                    document.getElementById("calcSummaryText").textContent,
                );
            }
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (response.ok) {
                formMessage.textContent = "Kiitos viestistäsi! Vastaamme pian.";
                formMessage.className = "form-message form-message--success";
                formMessage.style.display = "block";
                submitBtn.textContent = "Viesti lähetetty!";
                /* Nollaa lomake ja laskuriliitos */
                contactForm.reset();
                includeCalc.checked = false;
                document.getElementById("calcAttachPreview").style.display = "none";
                syncInterestSummary();
                setTimeout(function () {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 3000);
            } else {
                formMessage.textContent = "Virhe: " + (data.message || "Yritä uudelleen.");
                formMessage.className = "form-message form-message--error";
                formMessage.style.display = "block";
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        } catch (error) {
            formMessage.textContent = "Verkkovirhe. Tarkista yhteys ja yritä uudelleen.";
            formMessage.className = "form-message form-message--error";
            formMessage.style.display = "block";
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    /* Tyhjennä kentän virhe kun käyttäjä alkaa kirjoittaa */
    document.getElementById("contact-name").addEventListener("input", function () {
        document.getElementById("nameError").textContent = "";
    });
    document.getElementById("contact-email").addEventListener("input", function () {
        document.getElementById("emailError").textContent = "";
    });
    document.getElementById("contact-message").addEventListener("input", function () {
        document.getElementById("messageError").textContent = "";
    });

    /* ===== Recalculate hero height on resize ===== */
    window.addEventListener(
        "resize",
        function () {
            heroHeight = window.innerHeight;
        },
        { passive: true },
    );
})();
