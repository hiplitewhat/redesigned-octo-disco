
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve HTML from KV
    if (url.pathname === "/") {
      const html = await env.NOTES_KV.get("index.html");
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // Redirect to Discord login
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&response_type=code&scope=identify&redirect_uri=${env.REDIRECT_URI}`,
        302
      );
    }

    // Handle Discord OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: env.REDIRECT_URI,
        }),
      });

      const { access_token } = await tokenResponse.json();
      if (!access_token) return new Response("Login failed", { status: 500 });

      return new Response(`<script>localStorage.setItem("token", "${access_token}"); window.location.href = "/";</script>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Get user info
    if (url.pathname === "/user") {
      const token = request.headers.get("Authorization");
      if (!token) return new Response("Unauthorized", { status: 401 });

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { "Authorization": `Bearer ${token}` },
      });

      return new Response(await userResponse.text(), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not Found", { status: 404 });
  },
};
