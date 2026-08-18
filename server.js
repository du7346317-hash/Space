const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '10mb' })); // Aumentado limite para aceitar imagens em Base64
app.use(express.static('public'));

// Simulação de Banco de Dados em Memória
let users = [];
let servers = [];
let directMessages = {}; // Armazena o histórico das DMs: { 'id1-DM-id2': [ {user, text, time} ] }
let serverMessages = {}; // Armazena o histórico dos canais de texto: { channelId: [ {user, text, time} ] }

// ==========================================
// ROTAS DE USUÁRIOS E PERFIL
// ==========================================
app.post('/api/users/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
    }
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'E-mail já cadastrado.' });
    }

    const newUser = {
        id: 'user_' + Date.now(),
        username,
        email,
        password,
        avatar: null,
        status: 'online',
        friends: [],
        friendRequests: []
    };

    users.push(newUser);
    res.json({ message: 'Usuário cadastrado com sucesso!', user: newUser });
});

app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }
    res.json({ message: 'Login bem-sucedido!', user });
});

app.put('/api/users/profile', (req, res) => {
    try {
        const { userId, username, avatar } = req.body;
        const user = users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        if (username) user.username = username.trim();
        if (avatar !== undefined) user.avatar = avatar;

        res.json({ 
            message: 'Perfil atualizado com sucesso!', 
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
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
    }
});

// ==========================================
// ROTAS DE SERVIDORES E CONVITES
// ==========================================
app.get('/api/servers/:serverId/invite', (req, res) => {
    const server = servers.find(s => s.id === req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });
    
    res.json({ inviteLink: server.inviteCode });
});

// ==========================================
// SOCKET.IO (Persistência e Mensagens em Tempo Real)
// ==========================================
io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    socket.on('join-text', (channelId) => {
        socket.join(channelId);
        
        // Envia o histórico correspondente (seja DM ou canal de servidor)
        const history = directMessages[channelId] || serverMessages[channelId] || [];
        socket.emit('load-history', history);
    });

    socket.on('send-message', (data) => {
        const { channelId, text, user } = data;
        const messageData = { 
            user, 
            text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };

        // Salva na estrutura correta dependendo se é DM ou Canal de Servidor
        if (channelId.includes('-DM-')) {
            if (!directMessages[channelId]) directMessages[channelId] = [];
            directMessages[channelId].push(messageData);
        } else {
            if (!serverMessages[channelId]) serverMessages[channelId] = [];
            serverMessages[channelId].push(messageData);
        }

        io.to(channelId).emit('receive-message', { ...messageData, channelId });
    });

    socket.on('disconnect', () => {
        console.log('Usuário desconectado:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
