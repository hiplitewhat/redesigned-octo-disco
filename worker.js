export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GitHub OAuth Login Redirect
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    // GitHub OAuth Callback
    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Handle GitHub OAuth Callback
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Error: Missing GitHub code", { status: 400 });
  }

  try {
    // Get Access Token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: env.REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
    }

    // Fetch GitHub User Data
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();
    if (!userData.login) {
      return new Response("Error: Failed to fetch GitHub user data", { status: 500 });
    }

    // Redirect back to frontend with username
    return Response.redirect(
      `https://hiplitehehe.github.io/bookish-octo-robot/index.html?username=${encodeURIComponent(userData.login)}`,
      302
    );
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
