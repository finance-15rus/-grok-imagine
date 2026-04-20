const API = {
    BASE_URL: 'https://api.x.ai/v1',

    config: {
        apiKey: '',
        provider: 'huggingface', // 'huggingface', 'replicate', 'xai'
        model: 'stabilityai/stable-diffusion-xl-base-1.0',
        outputFormat: 'base64'
    },

    setConfig(config) {
        this.config = { ...this.config, ...config };
    },

    async generateImage(options) {
        const { prompt, ratio, style, quality, n = 1 } = options;

        if (this.config.provider === 'xai') {
            return this.generateXAIImage(options);
        } else if (this.config.provider === 'replicate') {
            return this.generateReplicateImage(options);
        } else {
            return this.generateHFImage(options);
        }
    },

    async generateXAIImage(options) {
        const { prompt, ratio, style, quality, n = 1 } = options;

        if (!this.config.apiKey) {
            throw new Error('API key not configured');
        }

        const aspectRatios = {
            '1:1': { width: 1024, height: 1024 },
            '16:9': { width: 1368, height: 770 },
            '9:16': { width: 770, height: 1368 },
            '4:3': { width: 1024, height: 768 },
            '3:4': { width: 768, height: 1024 },
            '3:2': { width: 1152, height: 768 }
        };

        const { width, height } = aspectRatios[ratio] || aspectRatios['1:1'];
        const resolution = quality === '2k' ? '2k' : '1k';

        const requestBody = {
            model: this.config.model,
            prompt,
            n: Math.min(n, 10),
            output_format: 'png',
            aspect_ratio: ratio || '1:1',
            resolution
        };

        if (style && style !== 'auto') {
            requestBody.prompt = `${prompt}, ${style} style`;
        }

        const response = await fetch(`${this.BASE_URL}/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }

        return response.json();
    },

    async generateHFImage(options) {
        const { prompt, ratio, style, n = 1 } = options;

        const width = 1024;
        const height = 1024;

        const stylePrompts = {
            'realistic': 'photorealistic, high detail, 8k',
            'anime': 'anime style, vibrant colors',
            'oil': 'oil painting style, brush strokes visible',
            'watercolor': 'watercolor painting, soft edges',
            'digital': 'digital art, detailed illustration',
            'sketch': 'pencil sketch, black and white',
            '3d': '3D render, octane render, unreal engine',
            'ghibli': 'studio ghibli style, hand painted'
        };

        const fullPrompt = style && style !== 'auto'
            ? `${prompt}, ${stylePrompts[style] || ''}`
            : prompt;

        const response = await fetch(
            `https://router.exllimav4l.hyperbolic.xyz/v1/images/generations`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: 'stabilityai/stable-diffusion-xl-base-1.0',
                    prompt: fullPrompt,
                    width,
                    height,
                    num_images: Math.min(n, 4)
                })
            }
        );

        if (!response.ok) {
            throw new Error(`HuggingFace API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            data: (data.images || [data]).map(img => ({
                url: img.url,
                b64_json: img.b64_json
            }))
        };
    },

    async generateReplicateImage(options) {
        const { prompt, style, n = 1 } = options;

        if (!this.config.apiKey) {
            throw new Error('Replicate API key not configured');
        }

        const stylePrompts = {
            'realistic': 'photorealistic, realistic photo, 8k quality',
            'anime': 'anime style, manga illustration',
            'oil': 'oil painting, classical art style',
            'watercolor': 'watercolor painting, artistic',
            'digital': 'digital art, cgsociety',
            'sketch': 'pencil sketch, black and white drawing',
            '3d': '3D render, cinema 4D, octane render',
            'ghibli': 'studio ghibli, hayao miyazaki style'
        };

        const fullPrompt = style && style !== 'auto'
            ? `${prompt}, ${stylePrompts[style] || ''}`
            : prompt;

        // Create prediction
        const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${this.config.apiKey}`
            },
            body: JSON.stringify({
                version: 'sdxl:39ed52f2a78e934b3ba6be2aa8655ea9e5fa12c17d6bcae94f1f6de41d60c4fe',
                input: {
                    prompt: fullPrompt,
                    num_outputs: Math.min(n, 4),
                    width: 1024,
                    height: 1024,
                    num_inference_steps: 30
                }
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Replicate API error: ${createResponse.status}`);
        }

        const prediction = await createResponse.json();

        // Poll for completion
        return this.pollReplicatePrediction(prediction.urls.get, prediction.id);
    },

    async pollReplicatePrediction(getUrl, predictionId, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = await fetch(`${getUrl}`, {
                headers: {
                    'Authorization': `Token ${this.config.apiKey}`
                }
            });

            if (!response.ok) continue;

            const result = await response.json();

            if (result.status === 'succeeded') {
                const outputs = Array.isArray(result.output) ? result.output : [result.output];
                return {
                    data: outputs.map(url => ({ url }))
                };
            } else if (result.status === 'failed') {
                throw new Error('Generation failed');
            }
        }

        throw new Error('Generation timeout');
    },

    async enhancePrompt(prompt) {
        // Use local enhancement without API
        const enhancements = [
            ', detailed, high quality, 4k',
            ', professional photography, studio lighting',
            ', masterpiece, best quality, award winning'
        ];

        const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
        return prompt + randomEnhancement;
    },

    async generateVideo(options) {
        const { prompt } = options;

        // Use Cloudflare Worker proxy to bypass CORS
        const workerUrl = 'https://grok-imagine-video.opttorgrussia.workers.dev/video';

        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Video generation failed');
        }

        return response.json();
    }
};
