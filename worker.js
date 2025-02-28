export default {
    async fetch(request, env) {
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

        return new Response("Not Found", { status: 404 });
    }
};

// Handle CORS preflight requests
function handleOptions(request) {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
    });
}

// User Registration
async function handleRegister(request, env) {
    try {
        const { username, password } = await request.json();

        // Fetch existing users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        const users = response.ok ? await response.json() : [];

        // Check if user already exists
        if (users.some(user => user.username === username)) {
            return new Response(JSON.stringify({ error: "Username already exists" }), {
                status: 400,
                headers: corsHeaders(request)
            });
        }

        // Hash password before storing
        const hashedPassword = await hashPassword(password);
        users.push({ username, password: hashedPassword });

        // Update GitHub file
        const updateResponse = await updateGitHubFile(users, env);
        if (!updateResponse.ok) {
            throw new Error("Failed to update user database");
        }

        return new Response(JSON.stringify({ message: "User registered successfully" }), {
            status: 201,
            headers: corsHeaders(request)
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Registration failed" }), {
            status: 500,
            headers: corsHeaders(request)
        });
    }
}

// User Login
async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();

        // Fetch users from GitHub
        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        if (!response.ok) throw new Error("Failed to fetch user data");

        const users = await response.json();

        // Find user
        const user = users.find(u => u.username === username);
        if (!user || !(await verifyPassword(password, user.password))) {
            return new Response(JSON.stringify({ error: "Invalid credentials" }), {
                status: 401,
                headers: corsHeaders(request)
            });
        }

        // Generate a basic token (consider using JWT in production)
        const token = btoa(`${username}:${Date.now()}`);

        return new Response(JSON.stringify({ message: "Login successful", token }), {
            status: 200,
            headers: corsHeaders(request)
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Login failed" }), {
            status: 500,
            headers: corsHeaders(request)
        });
    }
}

// Secure password hashing using Web Crypto API
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

// Verify hashed password
async function verifyPassword(password, hashedPassword) {
    const hashedAttempt = await hashPassword(password);
    return hashedAttempt === hashedPassword;
}

// Update GitHub File
async function updateGitHubFile(updatedData, env) {
    const githubRepo = "Hiplitehehe/Notes";
    const filePath = "K.json";
    const githubToken = env.GITHUB_TOKEN; // Use secret from Cloudflare environment

    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

    // Fetch current file metadata (SHA required for updating)
    const fileResponse = await fetch(getFileUrl, {
        headers: { 
            Authorization: `token ${githubToken}`,
            "User-Agent": "Cloudflare-Worker-User",
            Accept: "application/vnd.github.v3+json"
        }
    });
    if (!fileResponse.ok) throw new Error("Failed to fetch file metadata");
    
    const fileData = await fileResponse.json();
    const sha = fileData.sha;

    // Encode new data as Base64
    const updatedContent = btoa(JSON.stringify(updatedData, null, 2));

    // Send update request
    return fetch(getFileUrl, {
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
}

// Dynamic CORS Headers for Credentialed Requests
function corsHeaders(request) {
    const allowedOrigin = "https://hiplitehehe.github.io"; // Set your frontend URL

    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/json"
    };
}
