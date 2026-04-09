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
        const fpsEl = document.getElementById("heroFps");
        const toggleOutlineBtn = document.getElementById("toggleOutline");
        const toggleMouseForceBtn = document.getElementById("toggleMouseForce");
        const toggleParticleDrawQualityBtn = document.getElementById("toggleParticleDrawQuality");
        const toggleOutlineFiveFrameBtn = document.getElementById("toggleOutlineFiveFrame");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const TAU = Math.PI * 2;
        const DRIFT_LUT_SIZE = 256;
        const PARTICLE_SPRITE_SIZE_CURRENT = 128;
        const PARTICLE_SPRITE_SIZE_ENHANCED = 192;
        const PARTICLE_RENDER_SCALE_CURRENT = 3.7;
        const PARTICLE_RENDER_SCALE_ENHANCED = 4.1;

        /* ─── SÄÄDETTÄVÄT ASETUKSET ─── */

        /* Partikkelien väri (R, G, B) */
        const COLOR_R = 108;
        const COLOR_G = 135;
        const COLOR_B = 255;

        /* Partikkelien kirkkaus & koko */
        const PARTICLE_DENSITY = 0.00025; /* Partikkeleita per neliöpikseli */
        const PARTICLE_COUNT = Math.round(
            Math.max(30, Math.min(400, window.innerWidth * window.innerHeight * PARTICLE_DENSITY)),
        );
        const SIZE_MIN = 0.6; /* Pienin partikkeli (px) */
        const SIZE_MAX = 3.4; /* Suurin partikkeli (px) */
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
        const LOGO_MARGIN_SAMPLE_STEP = 10; /* Kuinka harvasti margin-alue tarkistetaan */
        const LOGO_ATTRACT = 0.035; /* Logon vetovoima — vetää partikkelit "kiertoradalle" */
        const LOGO_ATTRACT_RADIUS_FRAC = 0.15; /* Vetovoiman kantama (osuus näytön lävistäjästä) */
        const LOGO_ORBIT_FORCE = 0.012; /* Kevyt tangentiaalinen liike estää sahaamista logon ympärillä */

        /* Isotypen dynaaminen outline — lasketaan koko reunalle */
        const OUTLINE_SEGMENTS = 144; /* Kuinka tiheästi reuna näytteistetään */
        const OUTLINE_MAX_ALPHA = 1; /* Maksimikirkkaus (0–1) */
        const OUTLINE_THRESHOLD = 0.82; /* Kuinka paljon paikallista energiaa vaaditaan */
        const OUTLINE_SMOOTHING = 0.28; /* Kuinka nopeasti segmentit reagoivat */
        const OUTLINE_WIDTH = 1.45; /* Outlinen peruspaksuus (px) */
        const OUTLINE_BLUR = 7; /* Pehmeän hehkun määrä */
        const OUTLINE_RENDER_STEP = 2; /* Piirretään vain joka toinen segmentti suorituskyvyn vuoksi */
        const OUTLINE_SHADOW_ALPHA = 0.38; /* Kiinteä hehkun alpha on halvempi kuin segmenttikohtainen */
        const OUTLINE_INFLUENCE_RADIUS_FRAC = 0.038; /* Partikkelien vaikutusetäisyys */
        const OUTLINE_ENERGY_SCALE = 2.4; /* Kuinka paljon yli odotetun paikallistiheyden vaaditaan */
        const OUTLINE_CONTRAST = 2.35; /* Kuinka jyrkästi kirkkauserot kasvavat */
        const OUTLINE_STRAIGHT_EDGE_RATIO = 2.4; /* Milloin tangentti tulkitaan suoraksi reunaksi */
        const OUTLINE_STRAIGHTEN_STRENGTH = 0.7; /* Kuinka vahvasti suoria reunoja oikaistaan */
        const OUTLINE_MIN_ALPHA = 0.02; /* Piirtoraja hyvin himmeille segmenteille */
        const OUTLINE_ENERGY_BINS = 72; /* Kuinka karkeasti partikkelien energia kerätään kulmittain */
        const OUTLINE_FRAME_INTERVAL = 3; /* Kuinka usein outline päivitetään suhteessa partikkeliruutuihin */
        const OUTLINE_SLOW_FRAME_INTERVAL = 5; /* Testitila vielä hitaammalle outline-päivitykselle */

        /* Dynaamiset arvot — lasketaan uudelleen resize():ssä */
        let MOUSE_RADIUS = 180;
        let LOGO_ATTRACT_RADIUS = 50;
        let OUTLINE_INFLUENCE_RADIUS = 42;

        /* ─── /ASETUKSET ─── */

        let particles = [];
        let activeParticleCount = 0;
        const mouse = { x: -9999, y: -9999 };
        let animId = null;
        let w, h;
        const driftLookup = new Float32Array(DRIFT_LUT_SIZE);
        let particleSprite = null;
        let particleRenderScale = PARTICLE_RENDER_SCALE_CURRENT;
        let outlinePoints = [];
        let outlineRadii = [];
        let outlineAngles = [];
        let outlineSegmentBins = [];
        let outlineRadiusByBin = new Float32Array(0);
        let outlineLevels = [];
        let outlineEnergyBuffer = new Float32Array(0);
        let outlineSmoothedBuffer = new Float32Array(0);
        let outlineBinLevels = new Float32Array(0);
        let outlineBinEnergyBuffer = new Float32Array(0);
        let outlineBinSmoothedBuffer = new Float32Array(0);
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
        let logoHitMinX = 0,
            logoHitMaxX = 0,
            logoHitMinY = 0,
            logoHitMaxY = 0;
        let logoMarginMinX = 0,
            logoMarginMaxX = 0,
            logoMarginMinY = 0,
            logoMarginMaxY = 0;

        const maskSvgTemplateEl = document.getElementById("heroIsotypeMaskTemplate");
        const maskImg = new Image();
        let maskReady = false;
        const debugState = {
            outlineEnabled: true,
            mouseForceEnabled: true,
            particleDrawQualityEnabled: true,
            outlineFiveFrameEnabled: false,
        };
        const fpsState = {
            lastSampleTime: 0,
            frames: 0,
        };

        for (let i = 0; i < DRIFT_LUT_SIZE; i++) {
            driftLookup[i] = Math.sin((i / DRIFT_LUT_SIZE) * TAU);
        }

        function createParticleSprite() {
            const spriteCanvas = document.createElement("canvas");
            const spriteSize = debugState.particleDrawQualityEnabled
                ? PARTICLE_SPRITE_SIZE_ENHANCED
                : PARTICLE_SPRITE_SIZE_CURRENT;
            const spriteCtx = spriteCanvas.getContext("2d");
            const half = spriteSize * 0.5;

            spriteCanvas.width = spriteSize;
            spriteCanvas.height = spriteSize;
            spriteCtx.imageSmoothingEnabled = true;
            spriteCtx.imageSmoothingQuality = "high";

            const gradient = spriteCtx.createRadialGradient(half, half, 0, half, half, half);
            gradient.addColorStop(0, rgba(1));
            gradient.addColorStop(0.14, rgba(debugState.particleDrawQualityEnabled ? 0.98 : 0.92));
            gradient.addColorStop(0.32, rgba(debugState.particleDrawQualityEnabled ? 0.58 : 0.42));
            gradient.addColorStop(0.52, rgba(debugState.particleDrawQualityEnabled ? 0.18 : 0.12));
            gradient.addColorStop(1, rgba(0));
            spriteCtx.fillStyle = gradient;
            spriteCtx.fillRect(0, 0, spriteSize, spriteSize);

            particleSprite = spriteCanvas;
            particleRenderScale = debugState.particleDrawQualityEnabled
                ? PARTICLE_RENDER_SCALE_ENHANCED
                : PARTICLE_RENDER_SCALE_CURRENT;
        }

        function sampleDriftLookup(position) {
            const wrapped = position % DRIFT_LUT_SIZE;
            const baseIndex = Math.floor(wrapped);
            const nextIndex = (baseIndex + 1) & (DRIFT_LUT_SIZE - 1);
            const mix = wrapped - baseIndex;
            return driftLookup[baseIndex] * (1 - mix) + driftLookup[nextIndex] * mix;
        }

        function setToggleState(button, active) {
            if (!button) return;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        }

        function updateActiveParticleCount() {
            activeParticleCount = particles.length;
        }

        function updateFps(timestamp) {
            if (!fpsEl) return;
            if (!fpsState.lastSampleTime) fpsState.lastSampleTime = timestamp;

            fpsState.frames++;
            const elapsed = timestamp - fpsState.lastSampleTime;
            if (elapsed < 300) return;

            const fps = (fpsState.frames * 1000) / elapsed;
            fpsEl.textContent = "FPS " + Math.round(fps);
            fpsState.frames = 0;
            fpsState.lastSampleTime = timestamp;
        }

        function getOutlineFrameInterval() {
            return debugState.outlineFiveFrameEnabled
                ? OUTLINE_SLOW_FRAME_INTERVAL
                : OUTLINE_FRAME_INTERVAL;
        }

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
                outlineAngles = [];
                outlineSegmentBins = [];
                outlineRadiusByBin = new Float32Array(0);
                outlineLevels = [];
                outlineEnergyBuffer = new Float32Array(0);
                outlineSmoothedBuffer = new Float32Array(0);
                outlineBinLevels = new Float32Array(0);
                outlineBinEnergyBuffer = new Float32Array(0);
                outlineBinSmoothedBuffer = new Float32Array(0);
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
                outlineAngles = [];
                outlineSegmentBins = [];
                outlineRadiusByBin = new Float32Array(0);
                outlineLevels = [];
                outlineEnergyBuffer = new Float32Array(0);
                outlineSmoothedBuffer = new Float32Array(0);
                outlineBinLevels = new Float32Array(0);
                outlineBinEnergyBuffer = new Float32Array(0);
                outlineBinSmoothedBuffer = new Float32Array(0);
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
            outlineAngles = outlinePoints.map(function (point) {
                let angle = Math.atan2(point.y - isoCY, point.x - isoCX);
                if (angle < 0) angle += TAU;
                return angle;
            });
            outlineSegmentBins = outlineAngles.map(function (angle) {
                return Math.floor((angle / TAU) * OUTLINE_ENERGY_BINS) % OUTLINE_ENERGY_BINS;
            });
            outlineLevels = new Float32Array(outlinePoints.length);
            outlineEnergyBuffer = new Float32Array(outlinePoints.length);
            outlineSmoothedBuffer = new Float32Array(outlinePoints.length);
            outlineBinLevels = new Float32Array(OUTLINE_ENERGY_BINS);
            outlineBinEnergyBuffer = new Float32Array(OUTLINE_ENERGY_BINS);
            outlineBinSmoothedBuffer = new Float32Array(OUTLINE_ENERGY_BINS);
            outlineRadiusByBin = new Float32Array(OUTLINE_ENERGY_BINS);

            const binCounts = new Uint16Array(OUTLINE_ENERGY_BINS);
            for (let i = 0; i < outlineRadii.length; i++) {
                const binIndex = outlineSegmentBins[i];
                outlineRadiusByBin[binIndex] += outlineRadii[i];
                binCounts[binIndex]++;
            }

            for (let i = 0; i < OUTLINE_ENERGY_BINS; i++) {
                if (binCounts[i] > 0) {
                    outlineRadiusByBin[i] /= binCounts[i];
                }
            }

            for (let i = 0; i < OUTLINE_ENERGY_BINS; i++) {
                if (outlineRadiusByBin[i] > 0) continue;

                let prevIndex = (i - 1 + OUTLINE_ENERGY_BINS) % OUTLINE_ENERGY_BINS;
                while (prevIndex !== i && outlineRadiusByBin[prevIndex] === 0) {
                    prevIndex = (prevIndex - 1 + OUTLINE_ENERGY_BINS) % OUTLINE_ENERGY_BINS;
                }

                let nextIndex = (i + 1) % OUTLINE_ENERGY_BINS;
                while (nextIndex !== i && outlineRadiusByBin[nextIndex] === 0) {
                    nextIndex = (nextIndex + 1) % OUTLINE_ENERGY_BINS;
                }

                if (outlineRadiusByBin[prevIndex] > 0 && outlineRadiusByBin[nextIndex] > 0) {
                    outlineRadiusByBin[i] =
                        (outlineRadiusByBin[prevIndex] + outlineRadiusByBin[nextIndex]) * 0.5;
                } else if (outlineRadiusByBin[prevIndex] > 0) {
                    outlineRadiusByBin[i] = outlineRadiusByBin[prevIndex];
                } else if (outlineRadiusByBin[nextIndex] > 0) {
                    outlineRadiusByBin[i] = outlineRadiusByBin[nextIndex];
                }
            }

            outlineMinRadius = Math.min.apply(null, outlineRadii);
            outlineMaxRadius = Math.max.apply(null, outlineRadii);
        }

        function drawOutline() {
            if (!outlineCtx) return;

            outlineCtx.clearRect(0, 0, w, h);
            if (outlinePoints.length < 2) return;

            const ringHalfWidth = OUTLINE_INFLUENCE_RADIUS;
            const minRingRadius = outlineMinRadius - ringHalfWidth;
            const maxRingRadius = outlineMaxRadius + ringHalfWidth;
            const minRingRadiusSq = minRingRadius * minRingRadius;
            const maxRingRadiusSq = maxRingRadius * maxRingRadius;
            const localLevels = outlineEnergyBuffer;
            const smoothedLevels = outlineSmoothedBuffer;
            const binLevels = outlineBinEnergyBuffer;
            const smoothedBins = outlineBinSmoothedBuffer;
            const avgParticlesPerBin = Math.max(1, activeParticleCount / OUTLINE_ENERGY_BINS);
            const expectedLocalEnergy =
                Math.max(0.18, avgParticlesPerBin * 0.12) * OUTLINE_ENERGY_SCALE;

            binLevels.fill(0);
            let peakLevel = 0;

            for (let i = 0; i < activeParticleCount; i++) {
                const particle = particles[i];
                const centerDx = particle.x - isoCX;
                const centerDy = particle.y - isoCY;
                const centerDistSq = centerDx * centerDx + centerDy * centerDy;

                if (centerDistSq < minRingRadiusSq || centerDistSq > maxRingRadiusSq) {
                    continue;
                }

                const centerDist = Math.sqrt(centerDistSq);
                let angle = Math.atan2(centerDy, centerDx);
                if (angle < 0) angle += TAU;
                const binFloat = (angle / TAU) * OUTLINE_ENERGY_BINS;
                const baseBin = Math.floor(binFloat) % OUTLINE_ENERGY_BINS;
                const nextBin = (baseBin + 1) % OUTLINE_ENERGY_BINS;
                const binMix = binFloat - Math.floor(binFloat);
                const prevBin = (baseBin - 1 + OUTLINE_ENERGY_BINS) % OUTLINE_ENERGY_BINS;
                const expectedRadius =
                    (outlineRadiusByBin[baseBin] || centerDist) * 0.55 +
                    (outlineRadiusByBin[nextBin] || centerDist) * 0.25 +
                    (outlineRadiusByBin[prevBin] || centerDist) * 0.2;
                const radialDelta = Math.abs(centerDist - expectedRadius);
                if (radialDelta >= ringHalfWidth) continue;

                const radialWeight = 1 - radialDelta / ringHalfWidth;
                const energy = radialWeight * radialWeight;
                binLevels[baseBin] += energy * (1 - binMix);
                binLevels[nextBin] += energy * binMix;
                binLevels[prevBin] += energy * 0.2 * (1 - binMix);
                binLevels[(nextBin + 1) % OUTLINE_ENERGY_BINS] += energy * 0.12 * binMix;
            }

            for (let i = 0; i < binLevels.length; i++) {
                const prev = binLevels[(i - 1 + binLevels.length) % binLevels.length];
                const next = binLevels[(i + 1) % binLevels.length];
                smoothedBins[i] = (prev + binLevels[i] * 2 + next) * 0.25;
            }

            for (let i = 0; i < smoothedBins.length; i++) {
                const normalized = Math.min(1, smoothedBins[i] / expectedLocalEnergy);
                const boosted = Math.min(1, normalized * 1.35);
                const targetLevel = Math.pow(boosted, Math.max(1.15, OUTLINE_CONTRAST - 1));

                outlineBinLevels[i] += (targetLevel - outlineBinLevels[i]) * OUTLINE_SMOOTHING;
                if (outlineBinLevels[i] < 0.005) outlineBinLevels[i] = 0;
            }

            for (let i = 0; i < outlinePoints.length; i++) {
                const baseBin = outlineSegmentBins[i];
                const prevBin = (baseBin - 1 + OUTLINE_ENERGY_BINS) % OUTLINE_ENERGY_BINS;
                const nextBin = (baseBin + 1) % OUTLINE_ENERGY_BINS;
                localLevels[i] =
                    outlineBinLevels[baseBin] * 0.6 +
                    outlineBinLevels[prevBin] * 0.2 +
                    outlineBinLevels[nextBin] * 0.2;
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
            outlineCtx.shadowBlur = OUTLINE_BLUR + peakLevel * 10;
            outlineCtx.shadowColor = rgba(OUTLINE_SHADOW_ALPHA);

            for (let i = 0; i < outlinePoints.length; i += OUTLINE_RENDER_STEP) {
                const nextIndex = (i + OUTLINE_RENDER_STEP) % outlinePoints.length;
                const alpha =
                    (smoothedLevels[i] + smoothedLevels[nextIndex]) * 0.5 * OUTLINE_MAX_ALPHA;
                if (alpha < OUTLINE_MIN_ALPHA) continue;

                outlineCtx.beginPath();
                outlineCtx.moveTo(outlinePoints[i].x, outlinePoints[i].y);
                outlineCtx.lineTo(outlinePoints[nextIndex].x, outlinePoints[nextIndex].y);
                outlineCtx.lineWidth = OUTLINE_WIDTH + alpha * 1.1;
                outlineCtx.strokeStyle = rgba(alpha);
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
            logoHitMinX = isoRx;
            logoHitMaxX = isoRx + isoW;
            logoHitMinY = isoRy;
            logoHitMaxY = isoRy + isoH;
            logoMarginMinX = logoHitMinX - LOGO_MARGIN;
            logoMarginMaxX = logoHitMaxX + LOGO_MARGIN;
            logoMarginMinY = logoHitMinY - LOGO_MARGIN;
            logoMarginMaxY = logoHitMaxY + LOGO_MARGIN;

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

            return (LOGO_MARGIN - coarseHit) / LOGO_MARGIN;
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
                    driftPosX: Math.random() * DRIFT_LUT_SIZE,
                    driftPosY: Math.random() * DRIFT_LUT_SIZE,
                    driftVelX: Math.random() * 0.08 + 0.04,
                    driftVelY: Math.random() * 0.065 + 0.03,
                    driftAmpX: Math.random() * 0.008 + 0.003,
                    driftAmpY: Math.random() * 0.006 + 0.002,
                    orbitDir: Math.random() > 0.5 ? 1 : -1,
                });
            }
            updateActiveParticleCount();
        }

        let tick = 0;
        let outlineFrameTick = 0;

        function draw(timestamp) {
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            updateFps(timestamp || performance.now());
            tick++;
            const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS;
            const logoAttractRadiusSq = LOGO_ATTRACT_RADIUS * LOGO_ATTRACT_RADIUS;
            const logoMarginOuterRadius = outlineMaxRadius + LOGO_MARGIN;
            const logoMarginOuterRadiusSq = logoMarginOuterRadius * logoMarginOuterRadius;
            const mouseActive = debugState.mouseForceEnabled && mouse.x > -1000;

            for (let i = 0; i < activeParticleCount; i++) {
                const p = particles[i];

                /* Gentle wandering drift using a shared lookup table instead of per-particle trig */
                p.driftPosX += p.driftVelX;
                p.driftPosY += p.driftVelY;
                p.vx += sampleDriftLookup(p.driftPosX) * p.driftAmpX;
                p.vy += sampleDriftLookup(p.driftPosY) * p.driftAmpY;

                /* Repulsion from cursor — soft push */
                if (mouseActive) {
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < mouseRadiusSq && distSq > 0) {
                        const dist = Math.sqrt(distSq);
                        const force = REPULSION / distSq;
                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;
                    }
                }

                /* Repulsion from isotype shape + margin zone */
                const ldx = p.x - isoCX;
                const ldy = p.y - isoCY;
                const lDistSq = ldx * ldx + ldy * ldy;
                const inAttractRange = lDistSq < logoAttractRadiusSq;
                const inMarginRange = LOGO_MARGIN > 0 && lDistSq < logoMarginOuterRadiusSq;
                const inLogoHitBox =
                    p.x >= logoHitMinX &&
                    p.x <= logoHitMaxX &&
                    p.y >= logoHitMinY &&
                    p.y <= logoHitMaxY;
                const inLogoMarginBox =
                    p.x >= logoMarginMinX &&
                    p.x <= logoMarginMaxX &&
                    p.y >= logoMarginMinY &&
                    p.y <= logoMarginMaxY;

                let lDist = 1;
                let ndx = 0;
                let ndy = 0;
                if (inAttractRange || inMarginRange || inLogoHitBox) {
                    lDist = Math.sqrt(lDistSq) || 1;
                    ndx = ldx / lDist;
                    ndy = ldy / lDist;
                }

                let insideLogo = false;
                let marginFade = 0;
                if (inLogoMarginBox) {
                    insideLogo = inLogoHitBox ? isInsideLogo(p.x, p.y) : false;
                    if (!insideLogo && inMarginRange) {
                        marginFade = estimateLogoMarginFade(p.x, p.y, ndx, ndy);
                    }
                }

                if (insideLogo) {
                    /* Inside logo — full push out */
                    p.vx += ndx * LOGO_REPULSION;
                    p.vy += ndy * LOGO_REPULSION;
                } else if (marginFade > 0) {
                    /* Estimate margin depth only near the actual logo bounds */
                    if (marginFade > 0) {
                        const force = LOGO_REPULSION * marginFade * marginFade;
                        p.vx += ndx * force;
                        p.vy += ndy * force;
                    }
                }

                /* Gentle gravity pull toward logo from distance */
                if (!insideLogo && inAttractRange && lDist > LOGO_MARGIN) {
                    const attractFade = 1 - lDist / LOGO_ATTRACT_RADIUS;
                    p.vx -= ndx * LOGO_ATTRACT * attractFade;
                    p.vy -= ndy * LOGO_ATTRACT * attractFade;

                    const tangentX = -ndy * p.orbitDir;
                    const tangentY = ndx * p.orbitDir;
                    p.vx += tangentX * LOGO_ORBIT_FORCE * attractFade;
                    p.vy += tangentY * LOGO_ORBIT_FORCE * attractFade;
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

                /* Draw particle from a pre-rendered sprite instead of rebuilding a path */
                const renderSize = p.size * particleRenderScale;
                ctx.globalAlpha = p.alpha;
                ctx.drawImage(
                    particleSprite,
                    p.x - renderSize * 0.5,
                    p.y - renderSize * 0.5,
                    renderSize,
                    renderSize,
                );
            }

            ctx.globalAlpha = 1;

            outlineFrameTick = (outlineFrameTick + 1) % getOutlineFrameInterval();
            if (debugState.outlineEnabled && outlineFrameTick === 0) {
                drawOutline();
            } else if (!debugState.outlineEnabled && outlineCtx) {
                outlineCtx.clearRect(0, 0, w, h);
            }

            /* Faint connection lines between nearby particles */
            if (LINE_OPACITY > 0) {
                for (let i = 0; i < activeParticleCount; i++) {
                    for (let j = i + 1; j < activeParticleCount; j++) {
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

        if (toggleOutlineBtn) {
            toggleOutlineBtn.addEventListener("click", function () {
                debugState.outlineEnabled = !debugState.outlineEnabled;
                setToggleState(toggleOutlineBtn, debugState.outlineEnabled);
                if (!debugState.outlineEnabled && outlineCtx) {
                    outlineCtx.clearRect(0, 0, w, h);
                } else {
                    outlineFrameTick = 0;
                    drawOutline();
                }
            });
        }

        if (toggleMouseForceBtn) {
            toggleMouseForceBtn.addEventListener("click", function () {
                debugState.mouseForceEnabled = !debugState.mouseForceEnabled;
                setToggleState(toggleMouseForceBtn, debugState.mouseForceEnabled);
            });
        }

        if (toggleParticleDrawQualityBtn) {
            toggleParticleDrawQualityBtn.addEventListener("click", function () {
                debugState.particleDrawQualityEnabled = !debugState.particleDrawQualityEnabled;
                setToggleState(toggleParticleDrawQualityBtn, debugState.particleDrawQualityEnabled);
                createParticleSprite();
            });
        }

        if (toggleOutlineFiveFrameBtn) {
            toggleOutlineFiveFrameBtn.addEventListener("click", function () {
                debugState.outlineFiveFrameEnabled = !debugState.outlineFiveFrameEnabled;
                setToggleState(toggleOutlineFiveFrameBtn, debugState.outlineFiveFrameEnabled);
                outlineFrameTick = 0;
                if (debugState.outlineEnabled) drawOutline();
            });
        }

        setToggleState(toggleOutlineBtn, debugState.outlineEnabled);
        setToggleState(toggleMouseForceBtn, debugState.mouseForceEnabled);
        setToggleState(toggleParticleDrawQualityBtn, debugState.particleDrawQualityEnabled);
        setToggleState(toggleOutlineFiveFrameBtn, debugState.outlineFiveFrameEnabled);

        resize();
        createParticleSprite();
        createParticles();
        buildLogoMask();
        if (debugState.outlineEnabled) drawOutline();
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
                updateActiveParticleCount();
                buildLogoMask();
                outlineFrameTick = 0;
                if (debugState.outlineEnabled) drawOutline();
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
