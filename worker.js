export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("<h3>Error: Missing code</h3>", {
          headers: { "Content-Type": "text/html" },
          status: 400
        });
      }

      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CloudflareWorker"
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: env.REDIRECT_URI
          })
        });

        const tokenText = await tokenResponse.text();

        // Debug: Show full response on page
        if (!tokenText.includes("access_token")) {
          return new Response(`<h3>GitHub Response (No Token Found):</h3><pre>${tokenText}</pre>`, {
            headers: { "Content-Type": "text/html" },
            status: 500
          });
        }

        // Try extracting token manually
        const tokenMatch = tokenText.match(/access_token=([^&]+)/);
        const accessToken = tokenMatch ? tokenMatch[1] : null;

        if (!accessToken) {
          return new Response(`<h3>Error: Couldn't extract token</h3><pre>${tokenText}</pre>`, {
            headers: { "Content-Type": "text/html" },
            status: 500
          });
        }

        // Redirect back with token
        return Response.redirect(
          `https://hiplitehehe.github.io/bookish-octo-robot/index.html?token=${accessToken}`,
          302
        );

      } catch (error) {
        return new Response(`<h3>Error:</h3><pre>${error.message}</pre>`, {
          headers: { "Content-Type": "text/html" },
          status: 500
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
