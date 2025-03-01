export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Redirect to GitHub OAuth login
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    // 🔹 Handle GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      try {
        // 🔹 Request Access Token from GitHub
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: env.REDIRECT_URI,
          }),
        });

        const tokenText = await tokenResponse.text(); // ✅ Get raw response as text
        console.log("GitHub Token Response:", tokenText);

        // 🔹 If GitHub response contains "error=", show error
        if (tokenText.includes("error=")) {
          return new Response(`GitHub OAuth Error: ${tokenText}`, { status: 400 });
        }

        // 🔹 Redirect back to frontend with access token in URL
        return Response.redirect(
          `https://hiplitehehe.github.io/bookish-octo-robot/index.html?${tokenText}`,
          302
        );

      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
