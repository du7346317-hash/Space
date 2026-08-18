const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve os arquivos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Estado em memória (quem está online e onde)
const users = new Map();

io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    // Registra o usuário
    socket.on('register', (username) => {
        users.set(socket.id, { username, room: 'geral' });
        socket.join('geral');
        
        // Avisa a todos que alguém entrou
        io.to('geral').emit('receive-message', {
            user: 'Sistema',
            text: `${username} entrou no servidor!`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true
        });
    });

    // Recebe e repassa mensagens de texto
    socket.on('send-message', (data) => {
        io.to(data.room).emit('receive-message', {
            user: data.user,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: false
        });
    });

    // --- SINALIZAÇÃO PARA CHAMADA DE VOZ/TELA ---
    socket.on('join-voice', (roomId) => {
        const usersInRoom = Array.from(users.keys()).filter(id => id !== socket.id);
        socket.emit('all-voice-users', usersInRoom);
    });

    socket.on('sending-signal', (payload) => {
        io.to(payload.userToSignal).emit('user-joined-voice', {
            signal: payload.signal,
            callerID: payload.callerID
        });
    });

    socket.on('returning-signal', (payload) => {
        io.to(payload.callerID).emit('receiving-returned-signal', {
            signal: payload.signal,
            id: socket.id
        });
    });

    // Desconexão
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            io.to(user.room).emit('receive-message', {
                user: 'Sistema',
                text: `${user.username} saiu do servidor.`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                system: true
            });
            users.delete(socket.id);
        }
        io.emit('user-disconnected-voice', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Foguete lançado na porta ${PORT} 🚀`);
});
