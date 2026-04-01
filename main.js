
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

    document
        .querySelectorAll(".tab-image-wrapper")
        .forEach(function (wrapper) {
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
        if (e.key === "Escape" && lightbox.classList.contains("open"))
            closeLightbox();
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
            parts.push(
                inTier +
                    " hlö × " +
                    TIERS[i].rate.toFixed(2).replace(".", ",") +
                    " €",
            );
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

    document
        .getElementById("kioskMinus")
        .addEventListener("click", function () {
            if (kioskCount > 0) {
                kioskCount--;
                updateCalc();
            }
        });
    document
        .getElementById("kioskPlus")
        .addEventListener("click", function () {
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

    /* ===== Contact form (mailto) ===== */
    var contactForm = document.getElementById("contactForm");
    contactForm.addEventListener("submit", function (e) {
        e.preventDefault();

        var name = document.getElementById("contact-name").value.trim();
        var email = document.getElementById("contact-email").value.trim();
        var message = document.getElementById("contact-message").value.trim();

        if (!name || !email || !message) return;

        var subject = encodeURIComponent("Yhteydenotto: " + name);
        var body = encodeURIComponent(
            "Nimi: " +
                name +
                "\n" +
                "Sähköposti: " +
                email +
                "\n\n" +
                "Viesti:\n" +
                message,
        );

        window.location.href =
            "mailto:info@solidius.fi?subject=" + subject + "&body=" + body;
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
