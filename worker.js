addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleNote(path, request, userAgent) {
  try {
    const noteId = path.substring(6); // Extract note ID from "/note/{noteId}"
    const notes = await getNotesFromGitHub(userAgent);

    if (!notes[noteId]) {
      return new Response("Note Not Found", { status: 404 });
    }

    const noteContent = notes[noteId];

    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Note: ${noteId}</title></head>
      <body>
        <h1>Note: ${noteId}</h1>
        <pre>${noteContent}</pre>
        <a href="/">Back to Notes</a>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  } catch (error) {
    console.error("Error in handleNote:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');

  try {
    if (path === '/') {
      return handleIndex(userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === '/save' && request.method === 'POST') {
      return handleSave(request, userAgent);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, userAgent);
    } else if (path === '/register' && request.method === 'POST') {
      return handleRegister(request, userAgent);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Homepage (shows note links & login/register form)
async function handleIndex(request, userAgent) {
  try {
    // Get session data (assuming you use cookies for authentication)
    const cookieHeader = request.headers.get("Cookie") || "";
    const sessionUser = getSessionUser(cookieHeader);

    const notes = await getNotesFromGitHub(userAgent);
    const noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    let loginSection = `
      <h2>Login</h2>
      <form action="/login" method="POST">
        <input type="text" name="username" placeholder="Username" required><br>
        <input type="password" name="password" placeholder="Password" required><br>
        <input type="submit" value="Login">
      </form>

      <h2>Register</h2>
      <form action="/register" method="POST">
        <input type="text" name="username" placeholder="Username" required><br>
        <input type="password" name="password" placeholder="Password" required><br>
        <input type="submit" value="Register">
      </form>
    `;

    // If user is logged in, show logout button instead of login/register forms
    if (sessionUser) {
      loginSection = `
        <p>Welcome, ${sessionUser}!</p>
        <form action="/logout" method="POST">
          <input type="submit" value="Logout">
        </form>
      `;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Code Notes</title></head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>

        <h2>Make a New Note</h2>
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID" required><br>
          <textarea name="content" rows="5" cols="30" placeholder="Write your note here..." required></textarea><br>
          <input type="submit" value="Save Note">
        </form>

        ${loginSection} <!-- Show login/register if not logged in, else show logout -->
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Register a new user
async function handleRegister(request, userAgent) {
  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (!username || !password) {
      return new Response('Missing Username or Password', { status: 400 });
    }

    const users = await getUsersFromGitHub(userAgent);
    
    if (users[username]) {
      return new Response('Username already exists', { status: 409 });
    }

    users[username] = btoa(password); // Simple encoding (replace with hashing for security)
    await saveUsersToGitHub(users, userAgent);

    return new Response('Registration successful', { status: 200 });
  } catch (error) {
    console.error('Error in handleRegister:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Login (checks if user exists)
async function handleLogin(request, userAgent) {
  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (!username || !password) {
      return new Response('Missing Username or Password', { status: 400 });
    }

    const users = await getUsersFromGitHub(userAgent);

    if (users[username] && users[username] === btoa(password)) {
      return new Response('Login Successful', { status: 200 });
    } else {
      return new Response('Unauthorized', { status: 401 });
    }
  } catch (error) {
    console.error('Error in handleLogin:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Fetch user data from GitHub (K.json)
async function getUsersFromGitHub(userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/K.json`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      return {}; // Return empty object if file doesn't exist
    }

    const data = await response.json();
    return data.content ? JSON.parse(atob(data.content)) : {};
  } catch (error) {
    console.error('Error getting users:', error);
    return {};
  }
}

// Save users to GitHub (K.json)
async function saveUsersToGitHub(users, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/K.json`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    let sha = undefined;
    if (existingFile.ok) {
      const data = await existingFile.json();
      sha = data.sha;
    }

    await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/K.json`, {
      method: 'PUT',
      headers: {
        Authorization: `token YOUR_GITHUB_TOKEN`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        message: 'Update users',
        content: btoa(JSON.stringify(users)),
        sha: sha,
      }),
    });
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Fetch notes from GitHub (j.json)
async function getNotesFromGitHub(userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      return {}; // Return empty object if file doesn't exist
    }

    const data = await response.json();
    return data.content ? JSON.parse(atob(data.content)) : {};
  } catch (error) {
    console.error('Error getting notes:', error);
    return {};
  }
}

// Save notes to GitHub (j.json)
async function saveNotesToGitHub(notes, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`, {
      headers: { Authorization: `token YOUR_GITHUB_TOKEN`, 'User-Agent': userAgent },
    });

    let sha = undefined;
    if (existingFile.ok) {
      const data = await existingFile.json();
      sha = data.sha;
    }

    await fetch(`https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`, {
      method: 'PUT',
      headers: {
        Authorization: `token YOUR_GITHUB_TOKEN`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        message: 'Update notes',
        content: btoa(JSON.stringify(notes)),
        sha: sha,
      }),
    });
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}
