CaddEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/login' && method === 'POST') {
    return handleLogin(request);
  } else if (path === '/dashboard') {
    return handleDashboard(request);
  } else if (path.startsWith('/view_note/')) {
    return handleViewNote(request, path.substring(11));
  } else if (path.startsWith('/raw_note/')) {
    return handleRawNote(request, path.substring(10));
  } else if (path === '/new_note' && method === 'POST') {
    return handleNewNote(request);
  } else if (path === '/register' && method === 'POST') {
    return handleRegister(request);
  } else if (path.startsWith('/edit_note/') && method === 'POST') {
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
  } else if (path === '/admin'){
    return handleAdmin(request);
  }

  return new Response('Not Found', { status: 404 });
}

async function handleLogin(request) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  const users = await getUsers();
  const user = users.find(u => u.username === username);

  if (user && await verifyPassword(password, user.password)) {
    const sessionToken = await createSession(user.id);
    return Response.redirect('/dashboard', 302, {
      headers: { 'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; Max-Age=2592000` } // 30 days
    });
  } else {
    return renderTemplate('login.html', { error: 'Invalid credentials' });
  }
}

async function handleDashboard(request) {
  const session = await getSession(request);
  const user = session ? await getUserById(session.userId) : null;
  const notes = await getNotes();
  const searchParams = new URL(request.url).searchParams;
  const searchQuery = searchParams.get('search')?.toLowerCase() || '';

  let userNotes = notes;

  if (user) {
    userNotes = notes.filter(note => note.user === user.username && !note.pending_approval);
  } else {
    userNotes = notes.filter(note => !note.pending_approval);
  }

  if (searchQuery) {
    userNotes = userNotes.filter(note =>
      note.title.toLowerCase().includes(searchQuery) || note.content.toLowerCase().includes(searchQuery)
    );
  }

  return renderTemplate('dashboard.html', { userNotes, user, is_admin: user && user.is_admin });
}

async function handleViewNote(request, title) {
  const session = await getSession(request);
  const user = session ? await getUserById(session.userId) : null;
  const notes = await getNotes();
  const note = notes.find(n => n.title === title);

  if (!note) {
    return renderTemplate('error.html', { message: 'Note not found' });
  }

  if (request.method === 'POST' && user) {
    const formData = await request.formData();
    const commentContent = formData.get('comment');

    if (commentContent) {
      note.comments = note.comments || [];
      note.comments.push({
        user: user.username,
        content: commentContent,
        created_at: new Date().toISOString()
      });

      await saveNotes(notes, `Added comment to '${title}' by ${user.username}`);
      return Response.redirect(`/view_note/${title}`, 302);
    } else {
      return renderTemplate('view_note.html', { note, user, error: 'Comment cannot be empty' });
    }
  }

  return renderTemplate('view_note.html', { note, user });
}

async function handleRawNote(request, title) {
  const notes = await getNotes();
  const note = notes.find(n => n.title === title);

  if (note) {
    return new Response(note.content);
  } else {
    return new Response('Note not found', { status: 404 });
  }
}

async function handleNewNote(request) {
  const session = await getSession(request);
  const user = session ? await getUserById(session.userId) : null;

  if (!user) {
    return Response.redirect('/login', 302);
  }

  const formData = await request.formData();
  const title = formData.get('title');
  const content = formData.get('content');
  const universeId = formData.get('universe_id');
  const imageFile = formData.get('image');

  const [gameTitle, gameImageUrl] = await getRobloxGameInfo(universeId);
  if (!gameTitle || !gameImageUrl) {
    return renderTemplate('new_note.html', { error: 'Game details not found.' });
  }

  let noteImageUrl = null;
  if (imageFile && imageFile.type.startsWith('image/')) {
    noteImageUrl = await uploadImageToGithub(imageFile);
    if (!noteImageUrl) {
      return renderTemplate('new_note.html', { error: 'Error uploading image to GitHub.' });
    }
  }

  const notes = await getNotes();
  const newNote = {
    title,
    content,
    user: user.username,
    game_name: gameTitle,
    game_image_url: gameImageUrl,
    note_image_url: noteImageUrl,
    universe_id: universeId,
    comments: [],
    pending_approval: true
  };
  notes.push(newNote);

  await saveNotes(notes, `Added note '${title}' by ${user.username}, pending approval`);
  return Response.redirect('/dashboard', 302);
}

async function handleRegister(request) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  const users = await getUsers();
  if (users.find(u => u.username === username)) {
    return renderTemplate('register.html', { error: 'Username already exists.' });
  }

  const hashedPassword = await hashPassword(password);
  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    is_admin: false
  };
  users.push(newUser);

  await saveUsers(users, `Added user ${username}`);
  return Response.redirect('/login', 302);
}

async function handleEditNote(request, title) {
  const session = await getSession(request);
  const user = session ? await getUserById(session.userId) : null;

  if (!user) {
    return Response.redirect('/login', 302);
  }

  const notes = await getNotes();
  const note = notes.find(n => n.title === title && (n.user === user.username || user.is_admin));

  if (!note) {
    return renderTemplate('error.html', { message: 'Note not found
