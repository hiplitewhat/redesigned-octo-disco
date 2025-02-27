// Cloudflare Worker Code for a Code Notes Web App with GitHub Storage

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/') {
    return handleIndex();
  } else if (path.startsWith('/note/')) {
    return handleNote(path.substring(6)); // Extract note ID
  } else if (path === '/save' && request.method === 'POST') {
    return handleSave(request);
  } else {
    return new Response('Not Found', { status: 404 });
  }
}

async function handleIndex() {
  const noteList = await listNotes();
  const noteLinks = noteList.map(note => `<li><a href="/note/${note.name}">${note.name}</a></li>`).join('');

  const html = `
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

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

async function handleNote(noteId) {
  const noteContent = await getNote(noteId);

  if (noteContent === null) {
    return new Response('Note Not Found', { status: 404 });
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Note: ${noteId}</title>
    </head>
    <body>
      <h1>Note: ${noteId}</h1>
      <pre>${noteContent}</pre>
      <a href="/">Back to List</a>
    </body>
    </html>
  `;

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

const GITHUB_TOKEN = 'YOUR_GITHUB_TOKEN'; // Replace with your personal access token
const GITHUB_OWNER = 'YOUR_GITHUB_OWNER'; // Replace with your GitHub username or organization
const GITHUB_REPO = 'YOUR_GITHUB_REPO'; // Replace with your repository name
const GITHUB_PATH = 'notes/'; // Path within your repository to store notes

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
      return []; // Handle cases where the path doesn't exist or is empty
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
      return atob(data.content); // Decode base64 content
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
    if(existingNote){
      const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}${noteId}`,{headers:{Authorization: `token ${GITHUB_TOKEN}`}});
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
        content: btoa(content), // Encode content to base64
        sha: sha
      }),
    });

    if (!response.ok) {
      console.error('Error saving note:', await response.text());
    }

  } catch (error) {
    console.error('Error saving note:', error);
  }
}
