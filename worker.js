export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/callback") {
            const code = url.searchParams.get("code");
            if (!code) return new Response("No code provided", { status: 400 });

            const tokenData = await getGitHubToken(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, code);
            if (!tokenData.access_token) return new Response("OAuth failed", { status: 401 });

            const userData = await getGitHubUser(tokenData.access_token);
            if (!userData.login) return new Response("Failed to fetch user data", { status: 500 });

            return new Response(`<script>
                localStorage.setItem("username", "${userData.login}");
                window.location.href = "index.html";
            </script>`, { headers: { "Content-Type": "text/html" } });
        }

        return new Response("Not Found", { status: 404 });
    }
};

async function getGitHubToken(clientId, clientSecret, code) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json' // Ensure JSON response
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code
        })
    });

    const text = await response.text(); // Read raw response  
    console.log("GitHub Token Response:", text); // Debug output  

    try {
        return JSON.parse(text); // Try to parse JSON
    } catch (e) {
        throw new Error(`Failed to parse GitHub response: ${text}`);
    }
}

async function getGitHubUser(accessToken) {
    const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${accessToken}` }
    });

    return await response.json();
}
