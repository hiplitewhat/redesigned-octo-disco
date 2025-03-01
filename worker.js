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
        "Accept": "text/plain", // Request plain text response
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: env.REDIRECT_URI,
      }),
    });

    const tokenText = await tokenResponse.text(); // Get raw response as text

    // Return the raw response directly
    return new Response(tokenText, { status: tokenResponse.status, headers: { "Content-Type": "text/plain" } });

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}
