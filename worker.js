addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  try {
    if (path === '/') {
      return handleIndex(isMobile, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === '/save' && request.method === 'POST') {
      return handleSave(request, userAgent);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Show only note links on homepage
async function handleIndex(isMobile, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);

    let noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Code Notes</title></head>
      <body>
        <h1>Code Notes</h1>
        
        <h2>Note List</h2>
        <ul>${noteLinks}</ul>

        <h2>Login</h2>
        <form action="/login" method="POST">
          <label for="username">Username:</label><br>
          <input type="text" id="username" name="username"><br><br>
          <label for="password">Password:</label><br>
          <input type="password" id="password" name="password"><br><br>
          <input type="submit" value="Login">
        </form>
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Show individual note content
async function handleNote(noteId, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteContent = notes[noteId];

    if (!noteContent) {
      return new Response('Note Not Found', { status: 404 });
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Note: ${noteId}</title></head>
      <body>
        <h1>Note: ${noteId}</h1>
        <pre>${noteContent}</pre>
        <a href="/">Back to List</a>
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleNote:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Handle saving a note
async function handleSave(request, userAgent) {
  try {
    const formData = await request.formData();
    const noteId = formData.get('noteId');
    const content = formData.get('content');

    if (!noteId || !content) {
      return new Response('Missing Note ID or Content', { status: 400 });
    }

    const notes = await getNotesFromGitHub(userAgent);
    notes[noteId] = content;
    await saveNotesToGitHub(notes, userAgent);

    return Response.redirect(`/note/${noteId}`, 302);
  } catch (error) {
    console.error('Error in handleSave:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Handle login (placeholder, replace with actual authentication)
async function handleLogin(request) {
  try {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (username === 'admin' && password === 'password') {
      return new Response('Login Successful', { status: 200 });
    } else {
      return new Response('Unauthorized', { status: 401 });
    }
  } catch (error) {
    console.error('Error in handleLogin:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// GitHub API setup (update with your repo details)
const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_FILE = 'K.json'; // Make sure it's K.json

// Fetch notes from GitHub
async function getNotesFromGitHub(userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
    });

    if (!response.ok) {
      console.error('GitHub API error:', await response.text());
      return {}; // Return empty object if error
    }

    const data = await response.json();
    if (data && data.content) {
      return JSON.parse(atob(data.content));
    } else {
      return {}; // Return empty object if file is empty
    }
  } catch (error) {
    console.error('Error getting notes:', error);
    return {};
  }
}

// Save notes to GitHub
async function saveNotesToGitHub(notes, userAgent) {
  try {
    const existingFile = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
    });

    let sha = undefined;
    if (existingFile.ok) {
      const data = await existingFile.json();
      sha = data.sha;
    }

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
      body: JSON.stringify({
        message: 'Update notes',
        content: btoa(JSON.stringify(notes)),
        sha: sha,
      }),
    });

    if (!response.ok) {
      console.error('Error saving notes:', await response.text());
    }
  } catch (error) {
    console.error('Error saving notes:', error);
  }
}
