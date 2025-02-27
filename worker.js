// Cloudflare Worker Code for a Code Notes Web App with User Agent Conditional Logic

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('User-Agent');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (path === '/') {
    return handleIndex(isMobile);
  } else if (path.startsWith('/note/')) {
    return handleNote(path.substring(6), isMobile);
  } else if (path === '/save' && request.method === 'POST') {
    return handleSave(request);
  } else {
    return new Response('Not Found', { status: 404 });
  }
}

async function handleIndex(isMobile) {
  const noteList = await listNotes(); // Call listNotes here
  const noteLinks = noteList.map(note => `<li><a href="/note/${note.name}">${note.name}</a></li>`).join('');

  let html;
  if (isMobile) {
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes (Mobile)</title>
      </head>
      <body>
        <h1>Code Notes (Mobile)</h1>
        <ul>
          ${noteLinks}
        </ul>
        <form action="/save" method="POST">
          <input type="text" name="noteId" placeholder="Note ID"><br>
          <textarea name="content" rows="5" cols="30" placeholder="Content"></textarea><br>
          <input type="submit" value="Save">
        </form>
      </body>
      </html>
    `;
  } else {
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Code Notes</title>
      </head>
      <body>
        <h1>Code Notes</h1>
        <ul>
          ${noteLinks}
        </ul>
        <form action="/save" method="POST">
          <label for="noteId">Note ID:</label><br>
          <input type="text" id="noteId" name="noteId"><br><br>
          <label for="content">Content:</label><br>
          <textarea id="content" name="content" rows="10" cols="50"></textarea><br><br>
          <input type="submit" value="Save">
        </form>
      </body>
      </html>
    `;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleNote(noteId, isMobile) {
  const noteContent = await getNote(noteId); // Call getNote here

  if (noteContent === null) {
    return new Response('Note Not Found', { status: 404 });
  }

  let html;
  if (isMobile) {
    html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre style="font-size:12px;">${noteContent}</pre><a href="/">Back</a></body></html>`;
  } else {
    html = `<!DOCTYPE html><html><head><title>Note: ${noteId}</title></head><body><h1>Note: ${noteId}</h1><pre>${noteContent}</pre><a href="/">Back to List</a></body></html>`;
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleSave(request) {
  const formData = await request.formData();
  const noteId = formData.get('noteId');
  const content = formData.get('content');

  if (!noteId || !content) {
    return new Response('Missing Note ID or Content', { status: 400 });
  }

  await saveNote(noteId, content);

  return Response.redirect(`/note/${noteId}`, 302);
}

// GitHub Interaction (Replace with your GitHub credentials and repository details)

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN';
const GITHUB_OWNER = 'Hiplitehehe';
const GITHUB_REPO = 'Notes';
const GITHUB_PATH = '';

async function listNotes() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    const data = await response.json();
    if (Array.isArray(data)) {
      return data.filter(item => item.type === 'file').map(file => ({ name: file.name }));
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
}

async function getNote(noteId) {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    const data = await response.json();
    if (data && data.content) {
      return atob(data.content);
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting note:', error);
    return null;
  }
}

async function saveNote(noteId, content) {
  try {
    const existingNote = await getNote(noteId);
    let sha = undefined;
    if (existingNote) {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
      const data = await response.json();
      sha = data.sha;
    }

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update note: ${noteId}`,
        content: btoa(content),
        sha: sha,
      }),
    });

    if (!response.ok) {
      console.error('Error saving note:', await response.text());
    }
  } catch (error) {
    console.error('Error saving note:', error);
  }
}
