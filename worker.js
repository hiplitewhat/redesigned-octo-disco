export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GitHub OAuth Login - Redirect to GitHub
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    // GitHub OAuth Callback - Handle GitHub Response
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Error: Missing authorization code", { status: 400 });

      try {
        // Exchange code for access token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json" // Ensures JSON response
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: env.REDIRECT_URI
          })
        });

        // Handle response errors
        if (!tokenResponse.ok) {
          return new Response(`Error fetching token: ${tokenResponse.statusText}`, { status: tokenResponse.status });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
          return new Response(`Failed to get access token: ${JSON.stringify(tokenData)}`, { status: 500 });
        }

        // Fetch user data from GitHub
        const userResponse = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResponse.ok) {
          return new Response(`Error fetching user data: ${userResponse.statusText}`, { status: userResponse.status });
        }

        const userData = await userResponse.json();
        if (!userData.login) {
          return new Response("Failed to retrieve GitHub username", { status: 500 });
        }

        // Redirect to frontend with username and token
        return Response.redirect(
          `https://hiplitehehe.github.io/bookish-octo-robot/index.html?username=${encodeURIComponent(userData.login)}&access_token=${encodeURIComponent(accessToken)}`,
          302
        );

      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
