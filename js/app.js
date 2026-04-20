const App = {
    state: {
        mode: 'image',
        ratio: '1:1',
        quality: '1k',
        style: 'auto',
        batchSize: 1,
        currentImage: null
    },

    async init() {
        UI.init();
        this.setupEventListeners();
        this.loadState();
        await UI.renderHistory();

        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('clear-history')?.addEventListener('click', () => UI.clearHistory());
    },

    loadState() {
        this.state.mode = Utils.storage.get('mode', 'image');
        this.state.ratio = Utils.storage.get('ratio', '1:1');
        this.state.quality = Utils.storage.get('quality', '1k');
        this.state.style = Utils.storage.get('style', 'auto');
        this.state.batchSize = Utils.storage.get('batchSize', 1);

        this.updateUIState();
    },

    saveState() {
        Utils.storage.set('mode', this.state.mode);
        Utils.storage.set('ratio', this.state.ratio);
        Utils.storage.set('quality', this.state.quality);
        Utils.storage.set('style', this.state.style);
        Utils.storage.set('batchSize', this.state.batchSize);
    },

    updateUIState() {
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.state.mode);
        });

        document.querySelectorAll('[data-ratio]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.ratio === this.state.ratio);
        });

        document.querySelectorAll('[data-quality]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.quality === this.state.quality);
        });

        const styleSelect = document.getElementById('style-select');
        if (styleSelect) styleSelect.value = this.state.style;

        const batchInput = document.getElementById('batch-size');
        if (batchInput) batchInput.value = this.state.batchSize;

        UI.setMode(this.state.mode);
    },

    setupEventListeners() {
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.mode = btn.dataset.mode;
                this.saveState();
                this.updateUIState();
            });
        });

        document.querySelectorAll('[data-ratio]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.ratio = btn.dataset.ratio;
                this.saveState();
                this.updateUIState();
            });
        });

        document.querySelectorAll('[data-quality]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.quality = btn.dataset.quality;
                this.saveState();
                this.updateUIState();
            });
        });

        const styleSelect = document.getElementById('style-select');
        styleSelect?.addEventListener('change', () => {
            this.state.style = styleSelect.value;
            this.saveState();
        });

        const batchInput = document.getElementById('batch-size');
        batchInput?.addEventListener('change', () => {
            this.state.batchSize = Math.max(1, Math.min(10, parseInt(batchInput.value) || 1));
            batchInput.value = this.state.batchSize;
            this.saveState();
        });

        document.querySelector('.num-btn.plus')?.addEventListener('click', () => {
            if (this.state.batchSize < 10) {
                this.state.batchSize++;
                document.getElementById('batch-size').value = this.state.batchSize;
                this.saveState();
            }
        });

        document.querySelector('.num-btn.minus')?.addEventListener('click', () => {
            if (this.state.batchSize > 1) {
                this.state.batchSize--;
                document.getElementById('batch-size').value = this.state.batchSize;
                this.saveState();
            }
        });

        document.getElementById('enhance-btn')?.addEventListener('click', () => this.enhancePrompt());
        document.getElementById('clear-btn')?.addEventListener('click', () => {
            document.getElementById('prompt-input').value = '';
        });

        UI.elements.variationsBtn.addEventListener('click', () => this.generateVariations());
    },

    async enhancePrompt() {
        const promptInput = document.getElementById('prompt-input');
        const prompt = promptInput.value.trim();

        if (!prompt) return;

        const btn = document.getElementById('enhance-btn');
        btn.disabled = true;
        btn.textContent = 'Enhancing...';

        try {
            const enhanced = await API.enhancePrompt(prompt);
            promptInput.value = enhanced;
        } catch (err) {
            console.error('Enhance error:', err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                </svg>
                Enhance
            `;
        }
    },

    async generate() {
        const prompt = document.getElementById('prompt-input').value.trim();

        if (!prompt) {
            UI.showError('Please enter a prompt');
            return;
        }

        if (!API.config.apiKey) {
            UI.elements.settingsModal.classList.add('active');
            UI.showError('Please configure your API key in settings');
            return;
        }

        UI.showLoading(this.state.mode === 'video' ? 'Generating video...' : 'Generating images...');

        const progressInterval = setInterval(() => {
            const current = parseFloat(UI.elements.loadingBar.style.width) || 0;
            UI.updateLoadingProgress(Math.min(current + 5, 90) / 100);
        }, 500);

        try {
            if (this.state.mode === 'video') {
                const result = await API.generateVideo({ prompt });
                UI.hideLoading();
                UI.showSuccess('Video generated successfully!');
                UI.addToHistory({
                    type: 'video',
                    prompt,
                    imageUrl: result.video_url || result.url,
                    settings: { ...this.state }
                });
            } else {
                const result = await API.generateImage({
                    prompt,
                    ratio: this.state.ratio,
                    style: this.state.style,
                    quality: this.state.quality,
                    n: this.state.batchSize
                });

                UI.hideLoading();
                UI.showSuccess('Image generated successfully!');
                const images = result.data || [];
                UI.showResults(images);

                if (images.length > 0) {
                    const firstImage = images[0];
                    const imageUrl = firstImage.url || `data:image/png;base64,${firstImage.b64_json}`;

                    UI.addToHistory({
                        type: 'image',
                        prompt,
                        imageUrl,
                        settings: { ...this.state }
                    });

                    UI.state.currentImage = imageUrl;
                }
            }
        } catch (err) {
            UI.hideLoading();
            UI.showError(err.message || 'Generation failed');
        } finally {
            clearInterval(progressInterval);
        }
    },

    async generateVariations() {
        const currentImage = UI.state.currentImage;
        if (!currentImage) return;

        document.getElementById('prompt-input').value = 'Create variations of this image';
        UI.closeLightbox();
        await this.generate();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
