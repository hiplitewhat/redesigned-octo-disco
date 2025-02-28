export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return handleOptions();
        }

        if (request.method === "POST") {
            if (url.pathname === "/register") {
                return await handleRegister(request);
            } else if (url.pathname === "/login") {
                return await handleLogin(request);
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};

// Handle CORS preflight requests
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// User Registration
async function handleRegister(request) {
    try {
        const { username, password } = await request.json();

        // Fetch existing users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        const users = response.ok ? await response.json() : [];

        // Check if the user already exists
        if (users.some(user => user.username === username)) {
            return new Response(JSON.stringify({ error: "Username already exists" }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        // Add new user
        users.push({ username, password });

        // Update GitHub file (You need a GitHub API token for this step)
        const updateResponse = await updateGitHubFile(users);
        if (!updateResponse.ok) {
            throw new Error("Failed to update user database");
        }

        return new Response(JSON.stringify({ message: "User registered successfully" }), {
            status: 201,
            headers: corsHeaders()
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Registration failed" }), {
            status: 500,
            headers: corsHeaders()
        });
    }
}

// User Login
async function handleLogin(request) {
    try {
        const { username, password } = await request.json();

        // Fetch users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        if (!response.ok) throw new Error("Failed to fetch user data");

        const users = await response.json();

        // Validate user credentials
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            return new Response(JSON.stringify({ error: "Invalid credentials" }), {
                status: 401,
                headers: corsHeaders()
            });
        }

        // Generate a basic token (you should replace this with a better authentication method)
        const token = btoa(`${username}:${Date.now()}`);

        return new Response(JSON.stringify({ message: "Login successful", token }), {
            status: 200,
            headers: corsHeaders()
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Login failed" }), {
            status: 500,
            headers: corsHeaders()
        });
    }
}

// Update GitHub File (You need to replace `GITHUB_TOKEN`)
async function updateGitHubFile(updatedData) {
    const githubRepo = "Hiplitehehe/Notes";
    const filePath = "K.json";
    const githubToken = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"; // Replace with your actual token

    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

    // Fetch current file metadata (SHA required for updating)
    const fileResponse = await fetch(getFileUrl, {
        headers: { Authorization: `token ${githubToken}` }
    });
    const fileData = await fileResponse.json();
    const sha = fileData.sha;

    // Encode new data as Base64
    const updatedContent = btoa(JSON.stringify(updatedData, null, 2));

    // Send update request
    return fetch(getFileUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: "Update user data",
            content: updatedContent,
            sha
        })
    });
}

// CORS Headers
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };
}
