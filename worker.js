export default {
    async fetch(request) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const { email, password } = await request.json();
            if (!email || !password) {
                return new Response("Missing fields", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
            }

            const githubToken = "YOUR_GITHUB_TOKEN";
            const repo = "YOUR_USERNAME/YOUR_REPO";
            const filePath = "K.json";
            const branch = "main";

            const githubApiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
            const headers = {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github.v3+json",
            };

            let response = await fetch(githubApiUrl, { headers });
            if (!response.ok) {
                return new Response("Failed to fetch user data", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
            }

            let data = await response.json();
            let content = JSON.parse(atob(data.content));
            let sha = data.sha;

            if (content[email]) {
                return new Response("Email already registered", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
            }

            content[email] = { password };

            const updatedContent = {
                message: "New user registered",
                content: btoa(JSON.stringify(content, null, 2)),
                sha,
                branch,
            };

            response = await fetch(githubApiUrl, {
                method: "PUT",
                headers,
                body: JSON.stringify(updatedContent),
            });

            if (!response.ok) {
                return new Response("Failed to update user data", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
            }

            return new Response("User registered successfully", {
                status: 201,
                headers: { "Access-Control-Allow-Origin": "*" },
            });

        } catch (error) {
            return new Response("Server error", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
        }
    },
};
