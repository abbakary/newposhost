document.addEventListener('DOMContentLoaded', function() {
    // Initialize brand mapping from item name to brand
    function initializeBrandMapping(root) {
        const itemNameSelect = (root || document).getElementById?.('id_item_name') || (root || document).querySelector('#id_item_name');
        if (!itemNameSelect) return {};
        try {
            const brandsData = itemNameSelect.getAttribute('data-brands');
            return brandsData ? JSON.parse(brandsData) : {};
        } catch (e) {
            console.error('Error parsing brand mapping:', e);
            return {};
        }
    }

    const wizardContainer = document.getElementById('registrationWizard');

    // Helper: replace wizard HTML with smooth transition and re-init interactions
    function replaceWizardHtml(html) {
        if (!wizardContainer) return;
        wizardContainer.style.transition = 'opacity 150ms ease';
        wizardContainer.style.opacity = '0.4';
        setTimeout(() => {
            wizardContainer.innerHTML = html;
            wizardContainer.style.opacity = '1';
            initWizardInteractions(wizardContainer);
        }, 150);
    }

    // AJAX navigate to a step (GET)
    async function ajaxLoadStep(url, opts) {
        const options = opts || {};
        const u = new URL(url, window.location.origin);
        u.searchParams.set('load_step', '1');
        const res = await fetch(u.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) return;
        const data = await res.json();
        if (data.form_html) replaceWizardHtml(data.form_html);
        if (options.push !== false) {
            history.pushState({}, '', url);
        }
    }

    // AJAX submit the wizard form (POST)
    async function ajaxSubmitForm(currentForm) {
        const formData = new FormData(currentForm);
        const res = await fetch(window.location.href, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: formData
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.redirect_url) {
            window.location.href = data.redirect_url;
            return;
        }
        if (data.form_html) replaceWizardHtml(data.form_html);
        if (data.message && data.message_type && wizardContainer) {
            const alert = document.createElement('div');
            alert.className = `alert alert-${data.message_type} mt-2`;
            alert.textContent = data.message;
            wizardContainer.prepend(alert);
            setTimeout(() => alert.remove(), 3500);
        }
    }

    // Duplicate customer check (Step 1)
    async function checkDuplicateCustomer(root) {
        const scope = root || document;
        const nameEl = scope.querySelector('#id_full_name');
        const phoneEl = scope.querySelector('#id_phone');
        const typeEl = scope.querySelector('#id_customer_type');
        const orgEl = scope.querySelector('#id_organization_name');
        const taxEl = scope.querySelector('#id_tax_number');
        if (!nameEl || !phoneEl) return null;
        const full_name = (nameEl.value || '').trim();
        const phone = (phoneEl.value || '').trim();
        const customer_type = typeEl ? (typeEl.value || '').trim() : '';
        const organization_name = orgEl ? (orgEl.value || '').trim() : '';
        const tax_number = taxEl ? (taxEl.value || '').trim() : '';
        if (!full_name || !phone) return null;
        const params = new URLSearchParams({ full_name, phone, customer_type, organization_name, tax_number });
        const res = await fetch(`/api/customers/check-duplicate/?${params.toString()}`, { headers: { 'Accept': 'application/json' }});
        if (!res.ok) return null;
        return res.json();
    }

    function showExistingCustomerModal(data) {
        const modalEl = document.getElementById('existingCustomerModal');
        if (!modalEl || !data || !data.customer) return;
        const c = data.customer;
        const safe = (v) => (v == null ? '' : v);
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('existingCustomerName', safe(c.full_name));
        setText('existingCustomerCode', safe(c.code));
        setText('existingCustomerPhone', safe(c.phone));
        setText('existingCustomerType', safe(c.customer_type || 'personal'));
        setText('existingCustomerOrg', safe(c.organization_name || '-'));
        setText('existingCustomerTax', safe(c.tax_number || '-'));
        setText('existingCustomerEmail', safe(c.email || '-'));
        setText('existingCustomerVisits', c.total_visits != null ? c.total_visits : '-');
        setText('existingCustomerAddress', safe(c.address || '-'));
        const orderBtn = document.getElementById('existingCustomerCreateOrderBtn');
        const viewBtn = document.getElementById('existingCustomerViewBtn');
        if (orderBtn) orderBtn.setAttribute('href', c.create_order_url);
        if (viewBtn) viewBtn.setAttribute('href', c.detail_url);
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    }

    // Initialize per-step dynamic UI and behaviors (re-runs after DOM replacements)
    function initWizardInteractions(root) {
        if (!root) return;

        // Auto-format phone number
        const phoneInput = root.querySelector('input[name="phone"]');
        if (phoneInput && !phoneInput.__formatted) {
            phoneInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 13) value = value.substring(0, 13);
                e.target.value = value;
            });
            phoneInput.__formatted = true;
        }

        // Customer type dynamic fields
        (function setupCustomerType() {
            const customerTypeSelect = root.querySelector('select[name="customer_type"], #id_customer_type');
            const organizationField = root.querySelector('#organization-field');
            const taxField = root.querySelector('#tax-field');
            const personalSubtypeField = root.querySelector('#personal-subtype-field');
            function toggleCustomerTypeFields() {
                if (!customerTypeSelect) return;
                const selectedType = customerTypeSelect.value;
                [organizationField, taxField, personalSubtypeField].forEach(field => {
                    if (field) {
                        field.style.display = 'none';
                        const inputs = field.querySelectorAll('input, select, textarea');
                        inputs.forEach(input => input.removeAttribute('required'));
                    }
                });
                if (selectedType === 'personal') {
                    if (personalSubtypeField) {
                        personalSubtypeField.style.display = 'block';
                        const subtypeSelect = personalSubtypeField.querySelector('select');
                        if (subtypeSelect) subtypeSelect.setAttribute('required', 'required');
                    }
                } else if (["government", "ngo", "company"].includes(selectedType)) {
                    if (organizationField) {
                        organizationField.style.display = 'block';
                        const orgInput = organizationField.querySelector('input');
                        if (orgInput) orgInput.setAttribute('required', 'required');
                    }
                    if (taxField) {
                        taxField.style.display = 'block';
                        const taxInput = taxField.querySelector('input');
                        if (taxInput) taxInput.setAttribute('required', 'required');
                    }
                }
                setTimeout(() => {
                    [organizationField, taxField, personalSubtypeField].forEach(field => {
                        if (field && field.style.display === 'block') {
                            field.classList.add('animate-in');
                            setTimeout(() => field.classList.remove('animate-in'), 400);
                        }
                    });
                }, 50);
            }
            if (customerTypeSelect && !customerTypeSelect.__boundToggle) {
                customerTypeSelect.addEventListener('change', toggleCustomerTypeFields);
                customerTypeSelect.__boundToggle = true;
            }
            toggleCustomerTypeFields();
        })();

        // Intent card selection
        (function setupIntentCards() {
            const intentCards = root.querySelectorAll('.intent-card');
            const intentRadios = root.querySelectorAll('input[name="intent"]');
            function updateIntentCardStyles() {
                intentCards.forEach(card => {
                    const radio = card.querySelector('input[type="radio"]');
                    if (radio && radio.checked) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                });
            }
            intentCards.forEach(card => {
                if (!card.__intentBound) {
                    card.addEventListener('click', function() {
                        const radio = this.querySelector('input[type="radio"]');
                        if (radio) radio.checked = true;
                        updateIntentCardStyles();
                        const nextBtn = document.getElementById('nextStepBtn');
                        if (nextBtn) nextBtn.disabled = false;
                    });
                    card.__intentBound = true;
                }
            });
            intentRadios.forEach(radio => {
                if (!radio.__intentChangeBound) {
                    radio.addEventListener('change', updateIntentCardStyles);
                    radio.__intentChangeBound = true;
                }
            });
            updateIntentCardStyles();
        })();

        // Service and Sales card selection
        (function setupCheckCards() {
            function handleCheckCardClick(cards) {
                cards.forEach(card => {
                    if (!card.__checkBound) {
                        card.addEventListener('click', function() {
                            const checkbox = this.querySelector('input[type="checkbox"]');
                            const radio = this.querySelector('input[type="radio"]');
                            if (checkbox) {
                                checkbox.checked = !checkbox.checked;
                            } else if (radio) {
                                radio.checked = true;
                            }
                            updateCheckCardStyles(cards);
                            const nextBtn = document.getElementById('nextServiceBtn');
                            if (radio && nextBtn) nextBtn.disabled = false;
                        });
                        card.__checkBound = true;
                    }
                });
            }
            function updateCheckCardStyles(cards) {
                cards.forEach(card => {
                    const input = card.querySelector('input[type="checkbox"], input[type="radio"]');
                    if (input && input.checked) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                });
            }
            const serviceCards = root.querySelectorAll('.service-check-card, .service-card');
            const salesCards = root.querySelectorAll('.sales-check-card');
            if (serviceCards.length > 0) {
                handleCheckCardClick(serviceCards);
                updateCheckCardStyles(serviceCards);
            }
            if (salesCards.length > 0) {
                handleCheckCardClick(salesCards);
                updateCheckCardStyles(salesCards);
            }
        })();

        // Dynamic service type loading (if placeholder present)
        (function setupServiceTypeLoading() {
            const serviceTypeRadios = root.querySelectorAll('input[name="service_type"]');
            const serviceDetails = root.querySelector('#service-details');
            if (serviceTypeRadios.length && serviceDetails) {
                serviceTypeRadios.forEach(radio => {
                    if (!radio.__svcBound) {
                        radio.addEventListener('change', function() {
                            if (this.checked) {
                                const serviceType = this.value;
                                fetch(`/service-form/${serviceType}/`)
                                    .then(response => response.text())
                                    .then(html => { serviceDetails.innerHTML = html; })
                                    .catch(error => console.error('Error loading service form:', error));
                            }
                        });
                        radio.__svcBound = true;
                    }
                });
            }
        })();

        // Brand select auto-update (if available)
        (function setupBrandUpdate() {
            const brandMapping = initializeBrandMapping(root);
            const itemNameSelect = root.querySelector('#id_item_name');
            const brandSelect = root.querySelector('#id_brand');
            if (!itemNameSelect || !brandSelect) return;
            if (!itemNameSelect.__brandBound) {
                itemNameSelect.addEventListener('change', function() {
                    const selectedItem = this.value;
                    const brandName = brandMapping[selectedItem];
                    if (brandName) {
                        for (let i = 0; i < brandSelect.options.length; i++) {
                            if (brandSelect.options[i].text === brandName) {
                                brandSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                });
                itemNameSelect.__brandBound = true;
            }
        })();

        // Tooltips
        (function setupTooltips() {
            const nodes = [].slice.call(root.querySelectorAll('[data-bs-toggle="tooltip"]'));
            nodes.map(function (el) { return new bootstrap.Tooltip(el); });
        })();
    }

    // Event delegation for SPA-like behavior inside wizard container
    function bindWizardHandlers() {
        if (!wizardContainer) return;

        // Intercept step navigation links via delegation
        if (!wizardContainer.__stepLinkBound) {
            wizardContainer.addEventListener('click', function(e) {
                const link = e.target.closest && e.target.closest('[data-step-link="true"]');
                if (link) {
                    e.preventDefault();
                    ajaxLoadStep(link.href);
                }
            });
            wizardContainer.__stepLinkBound = true;
        }

        // Intercept form submission for all steps
        if (!wizardContainer.__submitBound) {
            wizardContainer.addEventListener('submit', async function(e) {
                const currentForm = e.target;
                if (!currentForm || currentForm.tagName !== 'FORM') return;

                // Basic required validation
                let isValid = true;
                const requiredFields = currentForm.querySelectorAll('[required]');
                requiredFields.forEach(field => {
                    if (!field.value || (field.type === 'checkbox' && !field.checked)) {
                        field.classList.add('is-invalid');
                        isValid = false;
                    } else {
                        field.classList.remove('is-invalid');
                    }
                });
                if (!isValid) {
                    e.preventDefault();
                    const firstInvalid = currentForm.querySelector('.is-invalid');
                    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }

                const stepInput = currentForm.querySelector('input[name="step"]');
                const currentStep = stepInput ? parseInt(stepInput.value, 10) : null;

                // For step 1, check duplicates before progressing
                if (currentStep === 1) {
                    e.preventDefault();
                    const result = await checkDuplicateCustomer(currentForm);
                    if (result && result.exists) {
                        showExistingCustomerModal(result);
                        return;
                    }
                    await ajaxSubmitForm(currentForm);
                    return;
                }

                // Default: AJAX submit
                e.preventDefault();
                await ajaxSubmitForm(currentForm);
            }, true);
            wizardContainer.__submitBound = true;
        }
    }

    // Auto-save form data (persist between step renders on the client)
    function setupAutoSave() {
        const form = wizardContainer ? wizardContainer.querySelector('form') : document.querySelector('form');
        function saveFormData() {
            if (!form) return;
            const formData = new FormData(form);
            const formObject = {};
            formData.forEach((value, key) => { formObject[key] = value; });
            localStorage.setItem('customerRegistrationData', JSON.stringify(formObject));
        }
        function loadFormData() {
            if (!form) return;
            const savedData = localStorage.getItem('customerRegistrationData');
            if (!savedData) return;
            try {
                const data = JSON.parse(savedData);
                Object.keys(data).forEach(key => {
                    const element = form.querySelector(`[name="${key}"]`);
                    if (element) {
                        if (element.type === 'checkbox' || element.type === 'radio') {
                            element.checked = data[key] === 'true' || data[key] === element.value;
                        } else {
                            element.value = data[key];
                        }
                    }
                });
            } catch (e) {
                console.error('Error loading form data:', e);
                localStorage.removeItem('customerRegistrationData');
            }
        }
        if (form && !form.__autosaveBound) {
            loadFormData();
            form.addEventListener('input', saveFormData);
            form.addEventListener('submit', function() { localStorage.removeItem('customerRegistrationData'); });
            form.__autosaveBound = true;
        }
    }

    // Handle browser back/forward without full reload
    function setupPopState() {
        if (setupPopState.__bound) return;
        window.addEventListener('popstate', function() {
            // Only handle while wizard is present
            if (document.getElementById('registrationWizard')) {
                ajaxLoadStep(window.location.href, { push: false });
            }
        });
        setupPopState.__bound = true;
    }

    // Initial setup on first page load
    bindWizardHandlers();
    initWizardInteractions(wizardContainer);
    setupAutoSave();
    setupPopState();
});
