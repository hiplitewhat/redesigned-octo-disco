export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/callback) {
            return await handleGitHubLogin(request, env);
        }

        return new Response("Not Found", { status: 404 });
    }
};

async function handleGitHubLogin(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return new Response(JSON.stringify({ error: "Missing OAuth code" }), { status: 400 });
    }

    try {
        // Step 1: Exchange code for access token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: code
            })
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new Error("Failed to obtain access token.");
        }

        // Step 2: Use access token to fetch GitHub user info
        const userResponse = await fetch("https://api.github.com/user", {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": "CloudflareWorker"
            }
        });

        const userData = await userResponse.json();

        return new Response(JSON.stringify({ username: userData.login }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
