const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Diz para o servidor entregar os arquivos da mesma pasta
app.use(express.static(__dirname));

// Quando alguém acessar o site, entrega o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Porta dinâmica para rodar perfeitamente no Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}!`);
});
