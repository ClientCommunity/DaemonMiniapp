export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    // If file not found and doesn't have an extension, fallback to index.html for SPA routing
    if (response.status === 404 && !url.pathname.includes('.')) {
      const indexReq = new Request(new URL('/', request.url), request);
      response = await env.ASSETS.fetch(indexReq);
    }

    // Ensure correct Content-Type headers for browser module loading
    const newHeaders = new Headers(response.headers);
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')) {
      newHeaders.set('content-type', 'application/javascript; charset=utf-8');
    } else if (url.pathname.endsWith('.css')) {
      newHeaders.set('content-type', 'text/css; charset=utf-8');
    } else if (url.pathname.endsWith('.json')) {
      newHeaders.set('content-type', 'application/json; charset=utf-8');
    } else if (url.pathname.endsWith('.html') || !url.pathname.includes('.')) {
      newHeaders.set('content-type', 'text/html; charset=utf-8');
    }

    // Cache control for immutable hashed assets
    if (url.pathname.startsWith('/assets/')) {
      newHeaders.set('cache-control', 'public, max-age=31536000, immutable');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
