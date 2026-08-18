const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const serverHttp = http.createServer(app);
const io = new Server(serverHttp);

app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Bancos de dados em memória
const users = []; // { id, username, email, password, avatar, status, friendRequests: [], friends: [] }
const servers = [];
const directMessages = {}; // idConversa: [mensagens]

// Registro
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || username.trim().length < 3) {
        return res.status(400).json({ error: 'Nome de usuário inválido!' });
    }
    if (users.find(u => u.email === email || u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Usuário ou e-mail já cadastrado!' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        avatar: null,
        status: 'Online',
        friends: [], // array de IDs de amigos
        friendRequests: [] // array de { fromId, fromUsername, fromAvatar }
    };
    users.push(newUser);
    res.json({ message: 'Conta criada com sucesso!' });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }
    res.json({
        message: 'Login realizado com sucesso!',
        user: { 
            id: user.id, 
            username: user.username, 
            email: user.email, 
            avatar: user.avatar, 
            status: user.status, 
            friends: user.friends,
            friendRequests: user.friendRequests 
        }
    });
});

// Enviar Pedido de Amizade (Validação de Usuário)
app.post('/api/friends/request', (req, res) => {
    const { senderId, targetUsername } = req.body;
    const sender = users.find(u => u.id === senderId);
    const target = users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());

    if (!target) {
        return res.status(404).json({ error: 'Usuário não encontrado. Verifique o nome digitado!' });
    }
    if (target.id === senderId) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo!' });
    }
    if (sender.friends.includes(target.id)) {
        return res.status(400).json({ error: 'Vocês já são amigos!' });
    }
    if (target.friendRequests.some(r => r.fromId === senderId)) {
        return res.status(400).json({ error: 'Pedido de amizade já enviado anteriormente!' });
    }

    target.friendRequests.push({
        fromId: sender.id,
        fromUsername: sender.username,
        fromAvatar: sender.avatar
    });

    res.json({ message: `Pedido de amizade enviado para ${target.username}!` });
});

// Responder Pedido de Amizade (Aceitar / Recusar)
app.post('/api/friends/respond', (req, res) => {
    const { userId, requestId, accept } = req.body;
    const user = users.find(u => u.id === userId);
    const sender = users.find(u => u.id === requestId);

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Remove do array de pedidos
    user.friendRequests = user.friendRequests.filter(r => r.fromId !== requestId);

    if (accept && sender) {
        if (!user.friends.includes(sender.id)) user.friends.push(sender.id);
        if (!sender.friends.includes(user.id)) sender.friends.push(user.id);
    }

    res.json({ message: accept ? 'Pedido aceito!' : 'Pedido recusado.', friends: user.friends, friendRequests: user.friendRequests });
});

// Buscar Amigos e Pedidos do Usuário
app.get('/api/friends/:userId', (req, res) => {
    const user = users.find(u => u.id === req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const fullFriends = users
        .filter(u => user.friends.includes(u.id))
        .map(u => ({ id: u.id, username: u.username, avatar: u.avatar, status: u.status }));

    res.json({
        friends: fullFriends,
        requests: user.friendRequests
    });
});

// Criar Servidor
app.post('/api/servers', (req, res) => {
    const { name, icon, categories, userId } = req.body;
    const inviteCode = 'space-' + Math.random().toString(36).substring(2, 8);
    const newServer = {
        id: Date.now().toString(),
        name,
        icon: icon || '🌌',
        inviteCode,
        categories: categories || [
            { id: 'cat-1', name: "TEXTO", channels: [{ id: 'ch-1', name: "geral", type: "text" }] },
            { id: 'cat-2', name: "VOZ", channels: [{ id: 'ch-2', name: "Sala Principal", type: "voice" }] }
        ],
        members: [userId]
    };
    servers.push(newServer);
    res.json({ message: 'Servidor criado com sucesso!', server: newServer });
});

// Modificar/Editar Canais ou Categorias do Servidor
app.put('/api/servers/:serverId/structure', (req, res) => {
    const { serverId } = req.params;
    const { categories } = req.body;
    const server = servers.find(s => s.id === serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

    server.categories = categories;
    res.json({ message: 'Estrutura atualizada!', server });
});

// Listar Servidores do Usuário
app.get('/api/servers', (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    const userServers = servers.filter(s => s.members.includes(userId));
    res.json(userServers);
});

// Entrar via Convite
app.post('/api/join', (req, res) => {
    const { inviteCode, userId } = req.body;
    const server = servers.find(s => s.inviteCode === inviteCode);
    if (!server) return res.status(404).json({ error: 'Convite inválido ou expirado.' });

    if (!server.members.includes(userId)) {
        server.members.push(userId);
    }
    res.json({ message: `Você entrou no servidor ${server.name}!`, server });
});

// Socket.io
io.on('connection', (socket) => {
    socket.on('join-text', (channelId) => {
        socket.join(channelId);
    });

    socket.on('send-message', (data) => {
        io.to(data.channelId).emit('receive-message', data);
    });

    socket.on('join-voice', (channelId) => {
        socket.join(channelId);
        socket.to(channelId).emit('user-joined-voice', socket.id);
    });
    socket.on('offer', (payload) => io.to(payload.target).emit('offer', { target: socket.id, offer: payload.offer }));
    socket.on('answer', (payload) => io.to(payload.target).emit('answer', { target: socket.id, answer: payload.answer }));
    socket.on('ice-candidate', (payload) => io.to(payload.target).emit('ice-candidate', { target: socket.id, candidate: payload.candidate }));
    socket.on('leave-voice', (channelId) => {
        socket.leave(channelId);
        socket.to(channelId).emit('user-left-voice', socket.id);
    });
});

const PORT = 3000;
serverHttp.listen(PORT, () => {
    console.log(`🚀 Space rodando na porta ${PORT} -> http://localhost:${PORT}`);
});
