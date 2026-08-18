const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const serverHttp = http.createServer(app);
const io = new Server(serverHttp);

// Aumenta o limite para aceitar imagens em base64 do computador
app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Bancos de dados em memória temporários
const users = [];
const servers = [];

// Rota de Registro
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (users.find(u => u.email === email || u.username === username)) {
        return res.status(400).json({ error: 'Usuário ou e-mail já cadastrado!' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        avatar: '🌌',
        status: 'Online',
        friends: []
    };
    users.push(newUser);
    res.json({ message: 'Conta criada com sucesso!' });
});

// Rota de Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }
    res.json({
        message: 'Login realizado com sucesso!',
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, status: user.status, friends: user.friends }
    });
});

// Criar Servidor
app.post('/api/servers', (req, res) => {
    const { name, icon, categories } = req.body;
    const inviteCode = 'space-' + Math.random().toString(36).substring(2, 8);
    const newServer = {
        id: Date.now().toString(),
        name,
        icon: icon || '🌌',
        inviteCode,
        categories: categories || []
    };
    servers.push(newServer);
    res.json({ message: 'Servidor criado com sucesso!', server: newServer });
});

// Listar Servidores
app.get('/api/servers', (req, res) => {
    res.json(servers);
});

// Criar Canal em um Servidor
app.post('/api/servers/:serverId/channels', (req, res) => {
    const { serverId } = req.params;
    const { categoryName, channelName, type } = req.body;
    
    const server = servers.find(s => s.id === serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

    let category = server.categories.find(c => c.name === categoryName);
    if (!category) {
        category = { name: categoryName, channels: [] };
        server.categories.push(category);
    }

    category.channels.push({ id: Date.now().toString(), name: channelName, type: type || 'text' });
    res.json({ message: 'Canal criado com sucesso!', server });
});

// Gerar/Pegar Link de Convite
app.get('/api/servers/:serverId/invite', (req, res) => {
    const { serverId } = req.params;
    const server = servers.find(s => s.id === serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });
    res.json({ inviteLink: `http://localhost:3000/?invite=${server.inviteCode}` });
});

// Entrar via Link de Convite
app.post('/api/join', (req, res) => {
    const { inviteCode } = req.body;
    const server = servers.find(s => s.inviteCode === inviteCode);
    if (!server) return res.status(404).json({ error: 'Convite inválido ou expirado.' });
    res.json({ message: `Você entrou no servidor ${server.name}!`, server });
});

// Configuração do WebRTC / Socket.io para Voz e Vídeo/Tela
io.on('connection', (socket) => {
    socket.on('join-voice', (channelId) => {
        socket.join(channelId);
        socket.to(channelId).emit('user-joined-voice', socket.id);

        socket.on('offer', (payload) => {
            io.to(payload.target).emit('offer', { target: socket.id, offer: payload.offer });
        });

        socket.on('answer', (payload) => {
            io.to(payload.target).emit('answer', { target: socket.id, answer: payload.answer });
        });

        socket.on('ice-candidate', (payload) => {
            io.to(payload.target).emit('ice-candidate', { target: socket.id, candidate: payload.candidate });
        });

        socket.on('leave-voice', () => {
            socket.leave(channelId);
            socket.to(channelId).emit('user-left-voice', socket.id);
        });
    });
});

const PORT = 3000;
serverHttp.listen(PORT, () => {
    console.log(`🚀 Space rodando completo na porta ${PORT} -> http://localhost:${PORT}`);
});