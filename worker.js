export default {
    async fetch(request) {
        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        const { email, password } = await request.json();
        if (!email || !password) {
            return new Response("Missing fields", { status: 400 });
        }

        const githubToken = "YOUR_GITHUB_TOKEN";
        const repo = "Hiplitehehe/Notes";
        const filePath = "K.json";
        const branch = "main"; // Change if needed

        const githubApiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const headers = {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
        };

        // Fetch current K.json
        let response = await fetch(githubApiUrl, { headers });
        if (!response.ok) {
            return new Response("Failed to fetch user data", { status: 500 });
        }

        let data = await response.json();
        let content = JSON.parse(atob(data.content)); // Decode Base64
        let sha = data.sha; // Needed for updating the file

        // Check if email exists
        if (content[email]) {
            return new Response("Email already registered", { status: 400 });
        }

        // Add new user
        content[email] = { password }; // Hashing should be done client-side or with a separate function

        // Upload updated data
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
            return new Response("Failed to update user data", { status: 500 });
        }

        return new Response("User registered successfully", { status: 201 });
    },
};
