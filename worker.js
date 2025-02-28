export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/github-auth" && request.method === "POST") {
            return await handleGitHubAuth(request, env);
        }

        return new Response("Not Found", { status: 404 });
    }
};

// GitHub OAuth Authentication
async function handleGitHubAuth(request, env) {
    try {
        const { code } = await request.json();
        const client_id = env.GITHUB_CLIENT_ID;
        const client_secret = env.GITHUB_CLIENT_SECRET;

        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ client_id, client_secret, code }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            return new Response(JSON.stringify({ error: tokenData.error_description }), { status: 400 });
        }

        return new Response(JSON.stringify({ access_token: tokenData.access_token }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: "GitHub auth failed" }), { status: 500 });
    }
}
