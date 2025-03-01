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
        "Accept": "application/json", // Ensure JSON response
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: env.REDIRECT_URI,
      }),
    });

    const tokenText = await tokenResponse.text(); // Get raw response as text

    // If GitHub returns an error, display the raw response
    if (!tokenResponse.ok) {
      return new Response(`GitHub Error: ${tokenText}`, { status: 400, headers: { "Content-Type": "text/plain" } });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText); // Try to parse JSON
    } catch (error) {
      return new Response(`Invalid JSON response from GitHub:\n\n${tokenText}`, { 
        status: 400, 
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (!tokenData.access_token) {
      return new Response(`GitHub response missing access_token:\n\n${JSON.stringify(tokenData, null, 2)}`, { 
        status: 400, 
        headers: { "Content-Type": "text/plain" }
      });
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
    return new Response(`Error: ${error.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}
