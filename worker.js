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

        // Show the entire GitHub response if it's unexpected
        if (!tokenResponse.ok || !tokenText.includes("access_token")) {
          return new Response(`<h1>GitHub Response Error</h1><pre>${tokenText}</pre>`, {
            status: 400, headers: { "Content-Type": "text/html" }
          });
        }

        let tokenData;
        try {
          tokenData = JSON.parse(tokenText);
        } catch (err) {
          return new Response(`<h1>JSON Parse Error</h1><pre>${tokenText}</pre>`, {
            status: 500, headers: { "Content-Type": "text/html" }
          });
        }

        if (!tokenData.access_token) {
          return new Response(`<h1>Error: No Access Token</h1><pre>${tokenText}</pre>`, {
            status: 400, headers: { "Content-Type": "text/html" }
          });
        }

        const userResponse = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userResponse.json();
        if (!userData.login) {
          return new Response(`<h1>Failed to Get User Data</h1><pre>${JSON.stringify(userData)}</pre>`, {
            status: 500, headers: { "Content-Type": "text/html" }
          });
        }

        return Response.redirect(
          `https://hiplitehehe.github.io/bookish-octo-robot/index.html?username=${encodeURIComponent(userData.login)}&token=${tokenData.access_token}`,
          302
        );
      } catch (error) {
        return new Response(`<h1>Unexpected Error</h1><pre>${error.message}</pre>`, {
          status: 500, headers: { "Content-Type": "text/html" }
        });
      }
    }

    return new Response("<h1>404 Not Found</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
  },
};
