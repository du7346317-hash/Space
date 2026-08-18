const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Caminho do arquivo de banco de dados local para persistência total no Render
const DB_FILE = path.join(__dirname, 'db.json');

// Função para carregar dados do arquivo
function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error("Erro ao ler db.json, recriando...", e);
        }
    }
    return { users: [], servers: [], directMessages: {}, serverMessages: {} };
}

// Função para salvar dados no arquivo
function saveDatabase(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDatabase();

// Mapeamento de usuários online para envio de notificações: { userId: socket.id }
let onlineUsers = {};

// ==========================================
// ROTAS DE USUÁRIOS E PERFIL
// ==========================================
app.post('/api/users/register', (req, res) => {
    db = loadDatabase();
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
    }
    
    if (db.users.find(u => u.email === email)) {
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

    db.users.push(newUser);
    saveDatabase(db);
    res.json({ message: 'Usuário cadastrado com sucesso!', user: newUser });
});

app.post('/api/users/login', (req, res) => {
    db = loadDatabase();
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }
    res.json({ message: 'Login bem-sucedido!', user });
});

app.put('/api/users/profile', (req, res) => {
    try {
        db = loadDatabase();
        const { userId, username, avatar } = req.body;
        const user = db.users.find(u => u.id === userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        if (username) user.username = username.trim();
        if (avatar !== undefined) user.avatar = avatar;

        saveDatabase(db);

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
    db = loadDatabase();
    const serverObj = db.servers.find(s => s.id === req.params.serverId);
    if (!serverObj) return res.status(404).json({ error: 'Servidor não encontrado.' });
    
    res.json({ inviteLink: serverObj.inviteCode });
});

// ==========================================
// SOCKET.IO (Persistência e Notificações)
// ==========================================
io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    // Registra o usuário online com o seu socket id
    socket.on('register-user', (userId) => {
        if (userId) {
            onlineUsers[userId] = socket.id;
        }
    });

    socket.on('join-text', (channelId) => {
        db = loadDatabase();
        socket.join(channelId);
        
        const history = db.directMessages[channelId] || db.serverMessages[channelId] || [];
        socket.emit('load-history', history);
    });

    socket.on('send-message', (data) => {
        db = loadDatabase();
        const { channelId, text, user } = data;
        const messageData = { 
            user, 
            text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };

        if (channelId.includes('-DM-')) {
            if (!db.directMessages[channelId]) db.directMessages[channelId] = [];
            db.directMessages[channelId].push(messageData);
            
            // Descobre quem é o destinatário na DM (ID 1 e ID 2)
            const ids = channelId.split('-DM-');
            const recipientId = ids[0] === user.id ? ids[1] : ids[0];
            
            // Se o destinatário estiver online, envia notificação direta mesmo fora da sala
            if (onlineUsers[recipientId]) {
                io.to(onlineUsers[recipientId]).emit('notify-unread', { channelId, messageData });
            }
        } else {
            if (!db.serverMessages[channelId]) db.serverMessages[channelId] = [];
            db.serverMessages[channelId].push(messageData);
        }

        saveDatabase(db);
        io.to(channelId).emit('receive-message', { ...messageData, channelId });
    });

    socket.on('disconnect', () => {
        // Remove dos usuários online
        for (let [userId, sId] of Object.entries(onlineUsers)) {
            if (sId === socket.id) {
                delete onlineUsers[userId];
                break;
            }
        }
        console.log('Usuário desconectado:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
