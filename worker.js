export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/auth") {
            return handleAuth(env);
        }

        if (url.pathname === "/callback") {
            return await handleCallback(request, env);
        }

        if (url.pathname === "/get-user") {
            return await getUserData(request, env);
        }

        return new Response("Not Found", { status: 404 });
    }
};

// 1️⃣ Redirect User to GitHub OAuth
function handleAuth(env) {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo`;
    return new Response(null, {
        status: 302,
        headers: { Location: authUrl }
    });
}

// 2️⃣ Handle GitHub OAuth Callback
async function handleCallback(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return new Response("Missing OAuth code", { status: 400 });
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code
        })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
        return new Response(JSON.stringify({ error: "Failed to get access token", details: tokenData }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ message: "Login successful", token: tokenData.access_token }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}

// 3️⃣ Fetch User Data from GitHub
async function getUserData(request, env) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch user data" }), {
            status: userResponse.status,
            headers: { "Content-Type": "application/json" }
        });
    }

    const userData = await userResponse.json();
    return new Response(JSON.stringify(userData), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}
