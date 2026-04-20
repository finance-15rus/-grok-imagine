export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    if (url.pathname === '/video') {
      const { prompt } = await request.json();

      const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${env.REPLICATE_API_KEY}`
        },
        body: JSON.stringify({
          version: 'video-forge/animatediff-highpy:latest',
          input: {
            prompt,
            num_frames: 24,
            fps: 8,
            num_inference_steps: 25
          }
        })
      });

      const prediction = await replicateResponse.json();

      if (!replicateResponse.ok) {
        return new Response(JSON.stringify({ error: prediction.error }), {
          status: replicateResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const pollUrl = prediction.urls.get;
      const predictionId = prediction.id;

      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(pollUrl, {
          headers: {
            'Authorization': `Token ${env.REPLICATE_API_KEY}`
          }
        });

        const result = await statusResponse.json();

        if (result.status === 'succeeded') {
          const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
          return new Response(JSON.stringify({ video_url: videoUrl }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else if (result.status === 'failed') {
          return new Response(JSON.stringify({ error: 'Video generation failed' }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Timeout' }), {
        status: 504,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
