export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            if (request.method === "OPTIONS") {
                return handleOptions(request);
            }

            if (request.method === "POST") {
                if (url.pathname === "/register") {
                    return await handleRegister(request, env);
                } else if (url.pathname === "/login") {
                    return await handleLogin(request, env);
                }
            }

            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders(request) });
        } catch (error) {
            return handleError(error, request);
        }
    }
};

// Handle CORS preflight requests
function handleOptions(request) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// User Registration
async function handleRegister(request, env) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            throw new Error("Missing username or password");
        }

        // Fetch existing users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }

        const users = await response.json();

        if (users.some(user => user.username === username)) {
            return new Response(JSON.stringify({ error: "Username already exists" }), {
                status: 400,
                headers: corsHeaders(request)
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);
        users.push({ username, password: hashedPassword });

        // Update GitHub file
        const updateResponse = await updateGitHubFile(users, env);
        if (!updateResponse.ok) {
            throw new Error(`Failed to update user database: ${updateResponse.status} ${updateResponse.statusText}`);
        }

        return new Response(JSON.stringify({ message: "User registered successfully" }), {
            status: 201,
            headers: corsHeaders(request)
        });
    } catch (error) {
        return handleError(error, request);
    }
}

// User Login
async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            throw new Error("Missing username or password");
        }

        // Fetch users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }

        const users = await response.json();

        const user = users.find(u => u.username === username);
        if (!user) {
            return new Response(JSON.stringify({ error: "Invalid username or password" }), {
                status: 401,
                headers: corsHeaders(request)
            });
        }

        if (!(await verifyPassword(password, user.password))) {
            return new Response(JSON.stringify({ error: "Invalid username or password" }), {
                status: 401,
                headers: corsHeaders(request)
            });
        }

        const token = btoa(`${username}:${Date.now()}`);

        return new Response(JSON.stringify({ message: "Login successful", token }), {
            status: 200,
            headers: corsHeaders(request)
        });
    } catch (error) {
        return handleError(error, request);
    }
}

// Password Hashing
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

// Verify Password
async function verifyPassword(password, hashedPassword) {
    const hashedAttempt = await hashPassword(password);
    return hashedAttempt === hashedPassword;
}

// Update GitHub File
async function updateGitHubFile(updatedData, env) {
    const githubRepo = "Hiplitehehe/Notes";
    const filePath = "K.json";
    const githubToken = env.GITHUB_TOKEN;

    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

    // Fetch current file metadata
    const fileResponse = await fetch(getFileUrl, {
        headers: {
            Authorization: `token ${githubToken}`,
            "User-Agent": "Cloudflare-Worker-User",
            Accept: "application/vnd.github.v3+json"
        }
    });

    if (!fileResponse.ok) {
        throw new Error(`GitHub API error (fetching file): ${fileResponse.status} ${fileResponse.statusText}`);
    }

    const fileData = await fileResponse.json();
    const sha = fileData.sha;

    // Encode new data as Base64
    const updatedContent = btoa(JSON.stringify(updatedData, null, 2));

    // Send update request
    const updateResponse = await fetch(getFileUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            "User-Agent": "Cloudflare-Worker-User",
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
            message: "Update user data",
            content: updatedContent,
            sha
        })
    });

    if (!updateResponse.ok) {
        throw new Error(`GitHub API error (updating file): ${updateResponse.status} ${updateResponse.statusText}`);
    }

    return updateResponse;
}

// Handle Errors
function handleError(error, request) {
    return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders(request)
    });
}

// Dynamic CORS Headers
function corsHeaders(request) {
    const allowedOrigin = "https://hiplitehehe.github.io";

    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
    };
}
