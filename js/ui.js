const UI = {
    elements: {},

    init() {
        this.cacheElements();
        this.setupTabs();
        this.setupModals();
        this.setupLightbox();
        this.loadSettings();
    },

    cacheElements() {
        this.elements = {
            tabs: document.querySelectorAll('.tab-content'),
            navBtns: document.querySelectorAll('.nav-btn'),
            promptInput: document.getElementById('prompt-input'),
            enhanceBtn: document.getElementById('enhance-btn'),
            clearBtn: document.getElementById('clear-btn'),
            generateBtn: document.getElementById('generate-btn'),
            resultsGrid: document.getElementById('results-grid'),
            styleSelect: document.getElementById('style-select'),
            batchGroup: document.getElementById('batch-group'),
            settingsModal: document.getElementById('settings-modal'),
            settingsBtn: document.getElementById('settings-btn'),
            closeSettings: document.getElementById('close-settings'),
            saveSettings: document.getElementById('save-settings'),
            apiKeyInput: document.getElementById('api-key'),
            lightbox: document.getElementById('lightbox'),
            lightboxImg: document.getElementById('lightbox-img'),
            lightboxClose: document.getElementById('lightbox-close'),
            downloadBtn: document.getElementById('download-btn'),
            variationsBtn: document.getElementById('variations-btn'),
            remixBtn: document.getElementById('remix-btn'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingBar: document.getElementById('loading-bar'),
            loadingText: document.getElementById('loading-text'),
            historyGrid: document.getElementById('history-grid'),
            clearHistory: document.getElementById('clear-history'),
            toastContainer: document.getElementById('toast-container')
        };
    },

    setupTabs() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                this.elements.navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.elements.tabs.forEach(tab => {
                    tab.classList.remove('active');
                    if (tab.id === `tab-${tabId}`) {
                        tab.classList.add('active');
                    }
                });
            });
        });
    },

    setupModals() {
        this.elements.settingsBtn?.addEventListener('click', () => {
            this.elements.settingsModal.classList.add('active');
        });

        this.elements.closeSettings?.addEventListener('click', () => {
            this.elements.settingsModal.classList.remove('active');
        });

        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.elements.settingsModal.classList.remove('active');
            }
        });

        this.elements.saveSettings?.addEventListener('click', () => {
            this.saveSettingsToStorage();
            this.elements.settingsModal.classList.remove('active');
        });

        const providerSelect = document.getElementById('ai-provider');
        providerSelect?.addEventListener('change', () => {
            this.updateProviderInfo(providerSelect.value);
        });
    },

    setupLightbox() {
        this.elements.lightboxClose?.addEventListener('click', () => {
            this.closeLightbox();
        });

        this.elements.lightbox?.addEventListener('click', (e) => {
            if (e.target === this.elements.lightbox) {
                this.closeLightbox();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        });
    },

    closeLightbox() {
        this.elements.lightbox?.classList.remove('active');
    },

    loadSettings() {
        const apiKey = Utils.storage.get('apiKey', '');
        const model = Utils.storage.get('model', 'stabilityai/stable-diffusion-xl-base-1.0');
        const outputFormat = Utils.storage.get('outputFormat', 'base64');
        const provider = Utils.storage.get('provider', 'huggingface');

        if (this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = apiKey;
        }

        const providerSelect = document.getElementById('ai-provider');
        if (providerSelect) providerSelect.value = provider;

        this.updateProviderInfo(provider);
        API.setConfig({ apiKey, model, outputFormat, provider });
    },

    updateProviderInfo(provider) {
        const hyperbolicInfo = document.getElementById('hyperbolic-info');
        const replicateInfo = document.getElementById('replicate-info');

        if (hyperbolicInfo) hyperbolicInfo.style.display = provider === 'huggingface' ? 'block' : 'none';
        if (replicateInfo) replicateInfo.style.display = provider === 'replicate' ? 'block' : 'none';
    },

    saveSettingsToStorage() {
        const apiKey = this.elements.apiKeyInput?.value || '';
        const model = document.getElementById('default-model')?.value || 'stabilityai/stable-diffusion-xl-base-1.0';
        const outputFormat = document.getElementById('output-format')?.value || 'base64';
        const provider = document.getElementById('ai-provider')?.value || 'huggingface';

        Utils.storage.set('apiKey', apiKey);
        Utils.storage.set('model', model);
        Utils.storage.set('outputFormat', outputFormat);
        Utils.storage.set('provider', provider);

        API.setConfig({ apiKey, model, outputFormat, provider });
    },

    showLoading(text = 'Generating...') {
        this.elements.loadingOverlay?.classList.add('active');
        this.elements.loadingText.textContent = text;
        this.elements.loadingBar.style.width = '0%';
    },

    updateLoadingProgress(progress) {
        this.elements.loadingBar.style.width = `${progress * 100}%`;
    },

    hideLoading() {
        this.elements.loadingOverlay?.classList.remove('active');
    },

    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showError(message) {
        this.showToast(message, 'error', 5000);
    },

    showSuccess(message) {
        this.showToast(message, 'success', 3000);
    },

    showResults(images) {
        const grid = this.elements.resultsGrid;

        if (!images || images.length === 0) {
            grid.innerHTML = `
                <div class="placeholder-card">
                    <div class="placeholder-icon">✧</div>
                    <p>No results generated</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = images.map((img, i) => `
            <div class="result-card" data-index="${i}" data-image="${img.url || img.b64_json ? (img.url || img.b64_json) : ''}">
                <img src="${img.url || `data:image/png;base64,${img.b64_json}`}" alt="Generated image ${i + 1}">
                <div class="result-info">${new Date().toLocaleTimeString()}</div>
            </div>
        `).join('');

        grid.querySelectorAll('.result-card').forEach(card => {
            card.addEventListener('click', () => {
                const image = card.dataset.image;
                if (image) {
                    this.openLightbox(image);
                }
            });
        });
    },

    openLightbox(imageUrl) {
        this.elements.lightboxImg.src = imageUrl;
        this.elements.lightbox.classList.add('active');

        this.elements.downloadBtn.onclick = () => {
            Utils.downloadImage(imageUrl, `grok-imagine-${Date.now()}.png`);
        };

        this.elements.remixBtn.onclick = () => {
            this.closeLightbox();
            document.querySelector('[data-tab="create"]').click();
        };
    },

    addToHistory(item) {
        Utils.idb.add({
            ...item,
            id: Utils.generateId(),
            timestamp: Date.now()
        }).then(() => this.renderHistory()).catch(console.error);
    },

    async renderHistory() {
        try {
            const history = await Utils.idb.getAll();
            const grid = this.elements.historyGrid;
            history.sort((a, b) => b.timestamp - a.timestamp);

            if (history.length === 0) {
                grid.innerHTML = `
                    <div class="placeholder-card">
                        <div class="placeholder-icon">📜</div>
                        <p>No generation history yet</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = history.map(item => `
                <div class="result-card" data-history-id="${item.id}">
                    <img src="${item.imageUrl}" alt="History item">
                    <div class="result-info">${item.prompt?.substring(0, 50) || 'Generated'}...</div>
                </div>
            `).join('');

            grid.querySelectorAll('.result-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.historyId;
                    const item = history.find(h => h.id == id);
                    if (item) {
                        this.openLightbox(item.imageUrl);
                    }
                });
            });
        } catch (err) {
            console.error('History render error:', err);
        }
    },

    clearHistory() {
        Utils.idb.clear().then(() => this.renderHistory()).catch(console.error);
    },

    setMode(mode) {
        const isVideo = mode === 'video';
        this.elements.batchGroup.style.display = isVideo ? 'none' : 'block';
    }
};
