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
      if (!code) return new Response("Error: Missing code", { status: 400 });

      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CloudflareWorker" // Ensure GitHub doesn't block the request
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: env.REDIRECT_URI
          })
        });

        // Get response as plain text
        const tokenText = await tokenResponse.text();

        // Return raw response directly in the page
        return new Response(`<pre>${tokenText}</pre>`, {
          headers: { "Content-Type": "text/html" }
        });

      } catch (error) {
        return new Response(`<pre>Error: ${error.message}</pre>`, {
          headers: { "Content-Type": "text/html" },
          status: 500
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
