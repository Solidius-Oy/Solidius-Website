(function () {
    "use strict";

    /* ===== Navigation scroll visibility ===== */
    var nav = document.getElementById("nav");
    var hero = document.getElementById("hero");
    var heroHeight = window.innerHeight;

    function handleNavVisibility() {
        if (window.scrollY > heroHeight * 0.75) {
            nav.classList.add("visible");
        } else {
            nav.classList.remove("visible");
        }
    }

    /* ===== Hero fade on scroll ===== */
    function handleHeroFade() {
        var scrollY = window.scrollY;
        var opacity = Math.max(0, 1 - scrollY / (heroHeight * 0.6));
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
        var canvas = document.getElementById("heroParticles");
        var ctx = canvas.getContext("2d");
        var dpr = Math.min(window.devicePixelRatio || 1, 2);

        /* ─── SÄÄDETTÄVÄT ASETUKSET ─── */

        /* Partikkelien väri (R, G, B) */
        var COLOR_R = 108;
        var COLOR_G = 135;
        var COLOR_B = 255;

        /* Partikkelien kirkkaus & koko */
        var PARTICLE_DENSITY = 0.00015; /* Partikkeleita per neliöpikseli */
        var PARTICLE_COUNT = Math.round(
            Math.max(30, Math.min(400, window.innerWidth * window.innerHeight * PARTICLE_DENSITY)),
        );
        var SIZE_MIN = 0.6; /* Pienin partikkeli (px) */
        var SIZE_MAX = 2.4; /* Suurin partikkeli (px) */
        var ALPHA_MIN = 0.1; /* Himmeimmät partikkelit (0–1) */
        var ALPHA_MAX = 1.0; /* Kirkkaimmat partikkelit (0–1) */

        /* Yhdistysviivat */
        var LINE_MAX_DIST = 100; /* Max etäisyys viivoille (px) */
        var LINE_OPACITY = 0.18; /* Viivojen kirkkaus (0–1) */
        var LINE_WIDTH = 0.5; /* Viivojen paksuus (px) */

        /* Liike */
        var MOUSE_RADIUS = 160; /* Kursorin vaikutusalue (px) */
        var REPULSION = 3500; /* Kursorin työntövoima */
        var DRIFT_SPEED = 0.05; /* Leijunnan maksiminopeus */
        var MAX_SPEED = 0.8; /* Absoluuttinen nopeusraja */
        var FRICTION = 0.98; /* Kitka (0.9–0.99, suurempi = liukkaampi) */
        var LOGO_REPULSION = 2.0; /* Logon hylkimisvoima (0–2) */
        var LOGO_MARGIN = 55; /* Tyhjä väli logon ympärillä (px) */
        var LOGO_ATTRACT = 0.012; /* Logon vetovoima kaukaa (0–0.1) */
        var LOGO_ATTRACT_RADIUS = 350; /* Etäisyys josta vetovoima alkaa (px) */

        /* ─── /ASETUKSET ─── */

        var particles = [];
        var mouse = { x: -9999, y: -9999 };
        var animId = null;
        var w, h;

        /* Logo collision mask */
        var maskCanvas = document.createElement("canvas");
        var maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
        var maskData = null;
        var logoOffX = 0,
            logoOffY = 0,
            logoW = 0,
            logoH = 0;

        function buildLogoMask() {
            var logoEl = hero.querySelector(".hero-logo");
            if (!logoEl) return;
            var heroRect = hero.getBoundingClientRect();
            var logoRect = logoEl.getBoundingClientRect();

            logoOffX = logoRect.left - heroRect.left;
            logoOffY = logoRect.top - heroRect.top;
            logoW = Math.round(logoRect.width);
            logoH = Math.round(logoRect.height);

            if (logoW === 0 || logoH === 0) return;

            maskCanvas.width = logoW;
            maskCanvas.height = logoH;
            maskCtx.clearRect(0, 0, logoW, logoH);

            /* Serialize SVG and draw to offscreen canvas */
            var svgClone = logoEl.cloneNode(true);
            svgClone.setAttribute("width", logoW);
            svgClone.setAttribute("height", logoH);
            svgClone.style.color = "white";
            svgClone.setAttribute("fill", "white");
            var svgStr = new XMLSerializer().serializeToString(svgClone);
            var img = new Image();
            img.onload = function () {
                maskCtx.drawImage(img, 0, 0, logoW, logoH);
                maskData = maskCtx.getImageData(0, 0, logoW, logoH).data;
            };
            img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
        }

        function isInsideLogo(px, py) {
            if (!maskData) return false;
            var lx = Math.round(px - logoOffX);
            var ly = Math.round(py - logoOffY);
            if (lx < 0 || ly < 0 || lx >= logoW || ly >= logoH) return false;
            /* Check alpha channel of the mask pixel */
            return maskData[(ly * logoW + lx) * 4 + 3] > 128;
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
        }

        function createParticles() {
            particles = [];
            for (var i = 0; i < PARTICLE_COUNT; i++) {
                var angle = Math.random() * Math.PI * 2;
                var speed = Math.random() * DRIFT_SPEED + 0.01;
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

        var tick = 0;

        function draw() {
            ctx.clearRect(0, 0, w, h);
            tick++;

            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];

                /* Gentle wandering drift (like dust floating in air) */
                p.vx += Math.sin(tick * p.driftFreq + p.driftPhase) * p.driftAmpX;
                p.vy += Math.cos(tick * p.driftFreq * 0.8 + p.driftPhase) * p.driftAmpY;

                /* Repulsion from cursor — soft push */
                var dx = p.x - mouse.x;
                var dy = p.y - mouse.y;
                var distSq = dx * dx + dy * dy;
                var dist = Math.sqrt(distSq);

                if (dist < MOUSE_RADIUS && dist > 0) {
                    var force = REPULSION / distSq;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                /* Repulsion from logo shape + margin zone */
                var logoCX = logoOffX + logoW * 0.5;
                var logoCY = logoOffY + logoH * 0.5;
                var ldx = p.x - logoCX;
                var ldy = p.y - logoCY;
                var lDist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
                var ndx = ldx / lDist;
                var ndy = ldy / lDist;

                if (isInsideLogo(p.x, p.y)) {
                    /* Inside logo — full push out */
                    p.vx += ndx * LOGO_REPULSION;
                    p.vy += ndy * LOGO_REPULSION;
                } else if (LOGO_MARGIN > 0) {
                    /* Check if within margin zone by sampling toward logo center */
                    var testX = p.x - ndx * LOGO_MARGIN;
                    var testY = p.y - ndy * LOGO_MARGIN;
                    if (isInsideLogo(testX, testY)) {
                        /* Estimate how deep into the margin we are */
                        var edgeDist = 0;
                        for (var s = 1; s <= LOGO_MARGIN; s++) {
                            if (isInsideLogo(p.x - ndx * s, p.y - ndy * s)) {
                                edgeDist = LOGO_MARGIN - s;
                                break;
                            }
                        }
                        var fade = edgeDist / LOGO_MARGIN;
                        var force = LOGO_REPULSION * fade * fade;
                        p.vx += ndx * force;
                        p.vy += ndy * force;
                    }
                }

                /* Gentle gravity pull toward logo from distance */
                if (!isInsideLogo(p.x, p.y) && lDist > LOGO_MARGIN && lDist < LOGO_ATTRACT_RADIUS) {
                    var attractFade = 1 - lDist / LOGO_ATTRACT_RADIUS;
                    p.vx -= ndx * LOGO_ATTRACT * attractFade;
                    p.vy -= ndy * LOGO_ATTRACT * attractFade;
                }

                /* Friction — keeps speeds from accumulating */
                p.vx *= FRICTION;
                p.vy *= FRICTION;

                /* Clamp max speed so particles stay dust-like */
                var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > MAX_SPEED) {
                    p.vx = (p.vx / speed) * MAX_SPEED;
                    p.vy = (p.vy / speed) * MAX_SPEED;
                    speed = MAX_SPEED;
                }

                p.x += p.vx;
                p.y += p.vy;

                /* Wrap around edges with margin */
                var margin = 20;
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

            /* Faint connection lines between nearby particles */
            for (var i = 0; i < particles.length; i++) {
                for (var j = i + 1; j < particles.length; j++) {
                    var dx = particles[i].x - particles[j].x;
                    var dy = particles[i].y - particles[j].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
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

            animId = requestAnimationFrame(draw);
        }

        hero.addEventListener(
            "mousemove",
            function (e) {
                var rect = hero.getBoundingClientRect();
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            },
            { passive: true },
        );

        hero.addEventListener("mouseleave", function () {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        /* Pause when hero is not visible */
        var particleObserver = new IntersectionObserver(
            function (entries) {
                if (entries[0].isIntersecting) {
                    if (!animId) animId = requestAnimationFrame(draw);
                } else {
                    if (animId) {
                        cancelAnimationFrame(animId);
                        animId = null;
                    }
                }
            },
            { threshold: 0 },
        );
        particleObserver.observe(hero);

        resize();
        createParticles();
        buildLogoMask();
        animId = requestAnimationFrame(draw);

        window.addEventListener(
            "resize",
            function () {
                var oldW = w;
                var oldH = h;
                resize();
                /* Scale particle positions to new dimensions instead of resetting */
                var scaleX = w / (oldW || 1);
                var scaleY = h / (oldH || 1);
                for (var i = 0; i < particles.length; i++) {
                    particles[i].x *= scaleX;
                    particles[i].y *= scaleY;
                }
                buildLogoMask();
            },
            { passive: true },
        );
    })();

    /* ===== Chevron click ===== */
    var chevron = document.getElementById("heroChevron");
    function scrollToContent() {
        var target = document.getElementById("tietoa");
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
    var hint = document.querySelector(".hero-chevron-hint");
    if (hint) {
        setTimeout(function () {
            hint.style.opacity = "0.7";
            hint.style.transform = "translateY(0)";
        }, 2500);
    }

    /* ===== Mobile menu ===== */
    var hamburger = document.getElementById("hamburger");
    var mobileMenu = document.getElementById("mobileMenu");
    var menuOpen = false;

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

    /* ===== Tabs (crossfade) ===== */
    var tabButtons = document.querySelectorAll(".tab-btn");
    var tabPanels = document.querySelectorAll(".tab-panel");

    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            var tabId = btn.getAttribute("data-tab");
            var targetPanel = document.getElementById("panel-" + tabId);
            var currentActive = document.querySelector(".tab-panel.active");

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
    var lightbox = document.getElementById("lightbox");
    var lightboxImg = lightbox.querySelector("img");
    var lightboxClose = lightbox.querySelector(".lightbox-close");

    document.querySelectorAll(".tab-image-wrapper").forEach(function (wrapper) {
        wrapper.addEventListener("click", function () {
            var img = wrapper.querySelector("img");
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
    var TIERS = [
        { min: 1, max: 20, rate: 3.9 },
        { min: 21, max: 75, rate: 2.9 },
        { min: 76, max: Infinity, rate: 1.9 },
    ];
    var MIN_FEE = 29;
    var KIOSK_PRICE = 35;
    var empCount = 10;
    var kioskCount = 0;

    var empSlider = document.getElementById("empSlider");
    var empDisplay = document.getElementById("empDisplay");
    var kioskCountEl = document.getElementById("kioskCount");
    var calcTotalEl = document.getElementById("calcTotal");
    var calcBreakdownEl = document.getElementById("calcBreakdown");
    var tierEls = [
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
        var cost = 0;
        for (var i = 0; i < TIERS.length; i++) {
            if (n <= 0) break;
            var inTier = Math.min(n, TIERS[i].max - TIERS[i].min + 1);
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
        var parts = [];
        var remaining = n;
        for (var i = 0; i < TIERS.length; i++) {
            if (remaining <= 0) break;
            var inTier = Math.min(remaining, TIERS[i].max - TIERS[i].min + 1);
            parts.push(inTier + " hlö × " + TIERS[i].rate.toFixed(2).replace(".", ",") + " €");
            remaining -= inTier;
        }
        if (kiosks > 0) parts.push(kiosks + " pääte × " + KIOSK_PRICE + " €");
        return parts.join(" + ");
    }

    function updateCalc() {
        empDisplay.innerHTML = empCount + " <span>hlö</span>";
        kioskCountEl.textContent = kioskCount;

        var empCost = Math.max(calcEmployeeCost(empCount), MIN_FEE);
        var total = empCost + kioskCount * KIOSK_PRICE;

        calcTotalEl.textContent = fmt(total);
        calcBreakdownEl.textContent = buildBreakdown(empCount, kioskCount);

        /* Sync summary text for contact form */
        var summaryEl = document.getElementById("calcSummaryText");
        if (summaryEl) {
            var lines = ["Henkilöt: " + empCount + " hlö"];
            if (kioskCount > 0) lines.push("Leimauspäätteet: " + kioskCount + " kpl");
            lines.push("Erittely: " + buildBreakdown(empCount, kioskCount));
            lines.push("Yhteensä: " + fmt(total) + " / kk (alv 0 %)");
            summaryEl.textContent = lines.join(" | ");
        }

        var active = activeTierIndex(empCount);
        tierEls.forEach(function (el, i) {
            el.classList.toggle("active", i === active);
        });

        /* Range fill track */
        var pct = ((empCount - 1) / 199) * 100;
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
    var animElements = document.querySelectorAll(".fade-in");
    var observer = new IntersectionObserver(
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
    var contactForm = document.getElementById("contactForm");
    var submitBtn = contactForm.querySelector("button[type='submit']");

    /* Nollaa checkbox sivun latautuessa (selain muistaa tilan muuten) */
    var includeCalcInit = document.getElementById("includeCalc");
    includeCalcInit.checked = false;
    document.getElementById("calcAttachPreview").style.display = "none";

    /* Kysy tarjous -nappi laskurissa */
    document.getElementById("calcQuoteBtn").addEventListener("click", function () {
        var checkbox = document.getElementById("includeCalc");
        checkbox.checked = true;
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

        var name = document.getElementById("contact-name").value.trim();
        var email = document.getElementById("contact-email").value.trim();
        var message = document.getElementById("contact-message").value.trim();
        var nameError = document.getElementById("nameError");
        var emailError = document.getElementById("emailError");
        var messageError = document.getElementById("messageError");
        var formMessage = document.getElementById("formMessage");

        /* Piilota aiemmat viestit */
        nameError.textContent = "";
        emailError.textContent = "";
        messageError.textContent = "";
        formMessage.className = "form-message";
        formMessage.style.display = "none";

        /* Validoi kaikki kentät kerralla */
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var valid = true;

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

        var originalText = submitBtn.textContent;
        submitBtn.textContent = "Lähetetään...";

        try {
            var formData = new FormData(contactForm);
            /* Liitä laskuridata vain jos checkbox on päällä */
            var includeCalc = document.getElementById("includeCalc");
            if (includeCalc.checked) {
                formData.append(
                    "Laskurin_arvio",
                    document.getElementById("calcSummaryText").textContent,
                );
            }
            var response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData,
            });
            var data = await response.json();

            if (response.ok) {
                formMessage.textContent = "Kiitos viestistäsi! Vastaamme pian.";
                formMessage.className = "form-message form-message--success";
                formMessage.style.display = "block";
                submitBtn.textContent = "Viesti lähetetty!";
                /* Nollaa lomake ja laskuriliitos */
                contactForm.reset();
                includeCalc.checked = false;
                document.getElementById("calcAttachPreview").style.display = "none";
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
