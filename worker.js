addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const cookies = request.headers.get('Cookie') || '';
  const session = cookies.split('; ').find(c => c.startsWith('session='))?.split('=')[1];

  try {
    if (path === '/') {
      return handleIndex(session, userAgent);
    } else if (path.startsWith('/note/')) {
      return handleNote(path.substring(6), userAgent);
    } else if (path === '/save' && request.method === 'POST' && session) {
      return handleSave(request, userAgent);
    } else if (path === '/register' && request.method === 'POST') {
      return handleRegister(request, userAgent);
    } else if (path === '/login' && request.method === 'POST') {
      return handleLogin(request, userAgent);
    } else if (path === '/logout') {
      return handleLogout();
    } else {
      return new Response('Unauthorized or Not Found', { status: 401 });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ------------------------- Notes Handling -------------------------

async function handleIndex(session, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteLinks = Object.keys(notes)
      .map(noteId => `<li><a href="/note/${noteId}">${noteId}</a></li>`)
      .join('');

    const loginOrLogout = session
      ? `<a href="/logout">Logout</a>`
      : `<a href="/login">Login</a> | <a href="/register">Register</a>`;

    const saveForm = session
      ? `
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID"><br>
          <textarea name="content" rows="5" cols="30" placeholder="Content"></textarea><br>
          <input type="submit" value="Save">
        </form>`
      : `<p><a href="/login">Login to add notes</a></p>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes</title>
      </head>
      <body>
        <h1>Code Notes</h1>
        <ul>${noteLinks}</ul>
        ${saveForm}
        ${loginOrLogout}
      </body>
      </html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    console.error('Error in handleIndex:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleNote(noteId, userAgent) {
  try {
    const notes = await getNotesFromGitHub(userAgent);
    const noteContent = notes[noteId];

    if (!noteContent) {
      return new Response('Note Not Found', { status: 404 });
    }

    return new Response(`<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre>${noteContent}</pre><a href="/">Back</a></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in handleNote:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

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

// ------------------------- User Authentication -------------------------

async function handleRegister(request, userAgent) {
  return new Response('Registration feature coming soon.', { status: 501 });
}

async function handleLogin(request, userAgent) {
  return new Response('Login feature coming soon.', { status: 501 });
}

function handleLogout() {
  return new Response('Logged out', {
    headers: {
      'Set-Cookie': 'session=; Max-Age=0; Path=/;',
    },
  });
}

// ------------------------- GitHub Interaction -------------------------

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_FILE = 'notes.json';

async function getNotesFromGitHub(userAgent) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': userAgent || 'Cloudflare-Worker-Notes-App',
      },
    });
    const data = await response.json();
    
    if (data && data.content) {
      return JSON.parse(atob(data.content));
    } else {
      return {}; // Return empty object if file doesn't exist or is empty
    }
  } catch (error) {
    console.error('Error getting notes:', error);
    return {};
  }
}

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
