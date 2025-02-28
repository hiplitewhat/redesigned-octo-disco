export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return handleOptions();
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

// SHA-256 Password Hashing
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// Verify Hashed Password
async function verifyPassword(inputPassword, storedHash) {
    const hashedInput = await hashPassword(inputPassword);
    return hashedInput === storedHash;
}

// User Registration
async function handleRegister(request, env) {
    try {
        const { username, password } = await request.json();
        if (!username || !password) throw new Error("Missing username or password");

        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        let users = response.ok ? await response.json() : [];

        if (!Array.isArray(users)) throw new Error("User data is not an array.");

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
        if (!username || !password) throw new Error("Missing username or password");

        const githubUrl = "https://raw.githubusercontent.com/Hiplitehehe/Notes/main/K.json";
        const response = await fetch(githubUrl);
        if (!response.ok) throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);

        let users = await response.json();
        if (!Array.isArray(users)) throw new Error("User data is not an array.");

        const user = users.find(u => u.username === username);
        if (!user) {
            return new Response(JSON.stringify({ error: "User does not exist" }), {
                status: 401,
                headers: corsHeaders(request)
            });
        }

        if (!(await verifyPassword(password, user.password))) {
            return new Response(JSON.stringify({ error: "Invalid password" }), {
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

// Update GitHub File
async function updateGitHubFile(updatedData, env) {
    const githubRepo = "Hiplitehehe/Notes";
    const filePath = "K.json";
    const githubToken = env.GITHUB_TOKEN;

    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

    const fileResponse = await fetch(getFileUrl, {
        headers: { Authorization: `token ${githubToken}` }
    });

    if (!fileResponse.ok) {
        return fileResponse; // Return GitHub API error response
    }

    const fileData = await fileResponse.json();
    const sha = fileData.sha;

    const updatedContent = btoa(JSON.stringify(updatedData, null, 2));

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
function corsHeaders(request) {
    return {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };
}

// Error Handling
function handleError(error, request) {
    return new Response(JSON.stringify({ error: error.message || "Something went wrong" }), {
        status: 500,
        headers: corsHeaders(request)
    });
}
