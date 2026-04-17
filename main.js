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
    /*
     * Particle system archived in particle-system.disabled.js.
     * It is intentionally not loaded to avoid the runtime cost.
     */

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
        if (hash === "#custom") return "custom";
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
        custom: document.getElementById("interestCustom"),
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
