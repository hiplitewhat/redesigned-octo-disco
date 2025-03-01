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
        return new Response("<h1>Error: Missing code</h1>", { 
          status: 400, headers: { "Content-Type": "text/html" }
        });
      }

      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code: code,
            redirect_uri: env.REDIRECT_URI
          })
        });

        const tokenText = await tokenResponse.text(); // Get raw response

        // Show the full response directly on the page
        return new Response(`<h1>GitHub Response</h1><pre>${tokenText}</pre>`, {
          headers: { "Content-Type": "text/html" }
        });

      } catch (error) {
        return new Response(`<h1>Unexpected Error</h1><pre>${error.message}</pre>`, {
          status: 500, headers: { "Content-Type": "text/html" }
        });
      }
    }

    return new Response("<h1>404 Not Found</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
  },
};
