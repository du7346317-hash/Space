const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Pasta public para os arquivos visuais (HTML, CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rota 1: Tela Inicial (Agora é o Login obrigatório)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota 2: O Painel de Servidor (Aparece pós-login)
app.get('/painel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

// Rota de Simulação de Login (Futuramente ligada ao Banco de Dados)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if(email && password) {
    // Se digitou algo, manda pro painel
    res.json({ success: true, redirect: '/painel' });
  } else {
    res.status(400).json({ success: false, message: 'Preencha o e-mail e a senha!' });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}!`);
});
