const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

// Banco de dados simulado em memória
let users = [];
let servers = [];
let messages = {}; // Mapeia channelId ou o conversationId para um array de mensagens

// Rotas de Autenticação e Usuários
app.post('/api/users/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos!' });
    }
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'E-mail já cadastrado!' });
    }

    const newUser = {
        id: 'user_' + Date.now(),
        username,
        email,
        password,
        avatar: null,
        friends: []
    };

    users.push(newUser);
    res.json({ message: 'Conta criada com sucesso!' });
});

app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos!' });
    }

    // Retorna o usuário sem a senha
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
});

app.put('/api/users/profile', (req, res) => {
    const { userId, username, avatar } = req.body;
    const user = users.find(u => u.id === userId);

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado!' });

    user.username = username || user.username;
    user.avatar = avatar !== undefined ? avatar : user.avatar;

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Perfil atualizado com sucesso!', user: safeUser });
});

// Rotas de Amigos
app.post('/api/friends/add', (req, res) => {
    const { userId, friendUsername } = req.body;
    const user = users.find(u => u.id === userId);
    const friend = users.find(u => u.username === friendUsername);

    if (!friend) {
        return res.status(404).json({ error: 'Usuário não encontrado!' });
    }

    if (user.id === friend.id) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo!' });
    }

    if (user.friends.some(f => f.id === friend.id)) {
        return res.status(400).json({ error: 'Vocês já são amigos!' });
    }

    // Adiciona reciprocamente
    user.friends.push({ id: friend.id, username: friend.username, avatar: friend.avatar });
    friend.friends.push({ id: user.id, username: user.username, avatar: user.avatar });

    res.json({ message: `Amigo ${friend.username} adicionado com sucesso!` });
});

// Rotas de Servidores
app.post('/api/servers/create', (req, res) => {
    const { name, ownerId } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do servidor obrigatório!' });

    const newServer = {
        id: 'srv_' + Date.now(),
        name,
        ownerId,
        channels: [
            { id: 'chan_general_' + Date.now(), name: 'geral', type: 'text' }
        ],
        members: [ownerId]
    };

    servers.push(newServer);
    res.json({ message: 'Servidor criado com sucesso!', server: newServer });
});

app.get('/api/servers/:userId', (req, res) => {
    const userServers = servers.filter(s => s.members.includes(req.params.userId));
    res.json(userServers);
});

// WebSocket (Socket.io) para Mensagens em Tempo Real
io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    socket.on('register-user', (userId) => {
        socket.join(userId);
    });

    socket.on('join-text', (channelId) => {
        socket.join(channelId);
        
        // Envia o histórico de mensagens se existir
        if (!messages[channelId]) messages[channelId] = [];
        socket.emit('load-history', messages[channelId]);
    });

    socket.on('send-message', (data) => {
        const { channelId, text, user } = data;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageData = { user, text, time, channelId };

        if (!messages[channelId]) messages[channelId] = [];
        messages[channelId].push(messageData);

        // Envia para todos no canal/conversa
        io.to(channelId).emit('receive-message', messageData);

        // Se for mensagem direta, notifica o outro usuário caso não esteja na sala
        if (channelId.includes('-DM-')) {
            const participants = channelId.split('-DM-');
            const recipientId = participants.find(id => id !== user.id);
            if (recipientId) {
                io.to(recipientId).emit('notify-unread', { channelId });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}! Acesse http://localhost:${PORT}`);
});
