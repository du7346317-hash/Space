const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Avisamos o servidor que as coisas do frontend (HTML, CSS) estão na pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Quando acessar o site, ele busca o index.html lá dentro
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Porta dinâmica pro Render
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}!`);
});
