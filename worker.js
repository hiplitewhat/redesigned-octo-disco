addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === 'http://n9.mcst.io:35834/login' && method === 'POST') {
    return handleLogin(request);
  } else if (path === 'http://n9.mcst.io:35834/dashboard') {
    return handleDashboard(request);
  } else if (path.startsWith('http://n9.mcst.io:35834/view_note/')) {
    return handleViewNote(request, path.substring(11));
  } else if (path.startsWith('http://n9.mcst.io:35834/raw_note/')) {
    return handleRawNote(request, path.substring(10));
  } else if (path === 'http://n9.mcst.io:35834/new_note' && method === 'POST') {
    return handleNewNote(request);
  } else if (path === 'http://n9.mcst.io:35834/register' && method === 'POST') {
    return handleRegister(request);
  } else if (path.startsWith('http://n9.mcst.io:35834/edit_note/') && method === 'POST') {
    return handleEditNote(request, path.substring(11));
  } else if (path.startsWith('/delete_note/') && method === 'POST') {
    return handleDeleteNote(request, path.substring(13));
  } else if (path === '/admin' && method === 'POST') {
    return handleAdmin(request);
  } else if (path === '/logout') {
    return handleLogout(request);
  }

  // Default routes for GET requests
  if (path === '/') {
    return Response.redirect('/login', 302);
  } else if (path === '/login') {
    return renderTemplate('login.html');
  } else if (path === '/dashboard') {
    return handleDashboard(request);
  } else if (path.startsWith('/view_note/')) {
    return handleViewNote(request, path.substring(11));
  } else if (path === '/new_note') {
    return renderTemplate('new_note.html');
  } else if (path === '/register') {
    return renderTemplate('register.html');
  } else if (path.startsWith('/edit_note/')) {
    return handleEditNote(request, path.substring(11));
  } else if (path === '/admin') {
    return handleAdmin(request);
  }

  return new Response('Not Found', { status: 404 });
}

// --- GitHub Interaction Functions ---
const GITHUB_OWNER = 'YourGitHubUsername'; // Replace
const GITHUB_REPO = 'YourRepoName'; // Replace
const GITHUB_TOKEN = GITHUB_TOKEN; // Set as secret in Cloudflare

async function fetchGitHubFile(path) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw+json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const content = JSON.parse(atob(data.content));
  return [content, data.sha];
}

async function updateGitHubFile(path, content, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const encodedContent = btoa(JSON.stringify(content, null, 4));
  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: encodedContent, sha }),
  });
}

// --- Data Access Functions ---
async function getNotes() {
  return fetchGitHubFile('Notes.json');
}

async function saveNotes(notes, message) {
  const [_, sha] = await getNotes();
  return updateGitHubFile('Notes.json', notes, sha, message);
}

async function getUsers() {
  return fetchGitHubFile('Users.json');
}

async function saveUsers(users, message) {
  const [_, sha] = await getUsers();
  return updateGitHubFile('Users.json', users, sha, message);
}

// --- User Authentication and Session Functions ---
async function getUserById(userId) {
  const [users, _] = await getUsers();
  return users.find(user => user.id === parseInt(userId));
}

async function createSession(userId) {
  // Simple session token generation (replace with a more secure method)
  return btoa(`${userId}:${Date.now()}`);
}

async function getSession(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(';')
    .find(cookie => cookie.trim().startsWith('session='));
  if (!sessionCookie) return null;
  const sessionToken = sessionCookie.split('=')[1];
  if (!sessionToken) return null;
  try {
    const [userId, _] = atob(sessionToken).split(':');
    return { userId: parseInt(userId) };
  } catch (e) {
    return null;
  }
}

async function verifyPassword(password, hashedPassword) {
  // Simple password verification (replace with bcrypt or similar)
  return password === hashedPassword;
}

async function hashPassword(password) {
  // Simple password hashing (replace with bcrypt or similar)
  return password;
}

// --- Image Upload Function ---
async function uploadImageToGithub(imageFile) {
  const filename = `${Date.now()}-${imageFile.name}`;
  const path = `images/${filename}`;
  const content = btoa(await imageFile.arrayBuffer());
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload image ${filename}`,
        content: content,
      }),
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.content.download_url;
}

// --- Roblox Game Info Function (Placeholder) ---
async function getRobloxGameInfo(universeId) {
  // Replace with actual Roblox API calls
  return [`Game ${universeId}`, 'https://via.placeholder.com/150'];
}

// --- Rendering Function (Placeholder) ---
function renderTemplate(templateName, data = {}) {
  // Replace with a template engine or simple string interpolation
  let html = `<h1>${templateName}</h1>`;
  if (data.error) html += `<p style="color: red;">${data.error}</p>`;
  if (data.userNotes) {
    html += '<ul>';
    data.userNotes.forEach(note => {
      html += `<li><a href="/view_note/${note.title}">${note.title}</a></li>`;
    });
    html += '</ul>';
  }
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
//Rest of the code.
