const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define que os arquivos visuais estão na pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Entrega o painel inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Prepara a conexão para o futuro chat e as calls
io.on('connection', (socket) => {
  console.log('Novo usuário conectado ao painel:', socket.id);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Servidor base online na porta ${PORT}!`);
});
