export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing GitHub authorization code", { status: 400 });

      // Exchange code for access token
      const githubTokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code,
          redirect_uri: "https://autumn-sky-4229.hiplitehehe.workers.dev/callback"
        })
      });

      const tokenText = await githubTokenRes.text(); // Debugging
      console.log("GitHub Token Response:", tokenText);

      let tokenData;
      try {
        tokenData = JSON.parse(tokenText);
      } catch (error) {
        return new Response(`GitHub OAuth Error: Invalid JSON Response\n${tokenText}`, { status: 400 });
      }

      if (tokenData.error) return new Response("GitHub OAuth Error: " + tokenData.error, { status: 400 });

      // Fetch user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData = await userRes.json();
      console.log("GitHub User Data:", userData);

      return Response.redirect(`https://hiplitehehe.github.io/bookish-octo-robot/index.html?user=${encodeURIComponent(userData.login)}`, 302);
    }

    return new Response("Not Found", { status: 404 });
  }
};
