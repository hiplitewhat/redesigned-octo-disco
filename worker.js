export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GitHub OAuth Login
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    // GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Error: Missing GitHub code", { status: 400 });
      }

      try {
        // Request GitHub Access Token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json" // Ensure JSON response
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code
          })
        });

        const tokenText = await tokenResponse.text(); // Raw response (for debugging)
        console.log("GitHub Token Response:", tokenText);

        // Check if token response contains an access token
        const tokenMatch = tokenText.match(/access_token=([^&]+)/);
        if (!tokenMatch) {
          return new Response(`<pre>GitHub Response:\n${tokenText}</pre>`, {
            headers: { "Content-Type": "text/html" }
          });
        }

        const accessToken = tokenMatch[1];

        // Redirect back to frontend with token
        return new Response(`
          <html>
            <head>
              <meta http-equiv="refresh" content="0;url=https://hiplitehehe.github.io/bookish-octo-robot/index.html?token=${accessToken}">
            </head>
            <body>
              <p>Redirecting... If not, click <a href="https://hiplitehehe.github.io/bookish-octo-robot/index.html?token=${accessToken}">here</a>.</p>
            </body>
          </html>
        `, { headers: { "Content-Type": "text/html" } });

      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
