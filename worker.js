addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Handle preflight requests (CORS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  try {
    // Read request body if it's a POST request
    let requestBody = {};
    if (request.method === "POST") {
      requestBody = await request.json();
    }

    // Handle registration logic
    if (request.url.includes("/register") && request.method === "POST") {
      return await handleRegister(requestBody);
    }

    // If the request doesn't match any known endpoints
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: corsHeaders(),
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

// Function to handle user registration
async function handleRegister(data) {
  if (!data.username || !data.password) {
    return new Response(JSON.stringify({ error: "Missing username or password" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Simulate saving user (you can replace this with actual GitHub API storage)
  return new Response(JSON.stringify({ success: true, message: "User registered successfully!" }), {
    status: 201,
    headers: corsHeaders(),
  });
}

// CORS Headers function
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}
