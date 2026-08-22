<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Minha Plataforma</title>
  <style>
    :root {
      /* Identidade visual própria: Tema Cyber Dark / Teal */
      --bg-primary: #0F172A;
      --bg-secondary: #1E293B;
      --accent: #10B981; /* Esmeralda */
      --accent-hover: #059669;
      --text-main: #F8FAFC;
      --speaking-glow: #22C55E; /* Borda verde ao falar */
    }

    body {
      margin: 0;
      background-color: var(--bg-primary);
      color: var(--text-main);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    /* Modal / Painel Inicial */
    .join-panel {
      width: 400px;
      margin: 100px auto;
      padding: 24px;
      background-color: var(--bg-secondary);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }

    .input-field {
      width: 100%;
      padding: 12px;
      margin: 8px 0 16px 0;
      box-sizing: border-box;
      background-color: var(--bg-primary);
      border: 1px solid #334155;
      color: white;
      border-radius: 6px;
    }

    .btn-group {
      display: flex;
      gap: 12px;
    }

    .btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
    }

    .btn-primary { background-color: var(--accent); color: white; }
    .btn-primary:hover { background-color: var(--accent-hover); }

    /* Estilo do Avatar e Borda de Fala */
    .avatar-container {
      position: relative;
      width: 48px;
      height: 48px;
    }

    .user-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid transparent;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }

    /* Classe ativada dinamicamente via JS quando o microfone detecta áudio */
    .user-avatar.speaking {
      border-color: var(--speaking-glow);
      box-shadow: 0 0 12px var(--speaking-glow);
    }
  </style>
</head>
<body>

  <!-- Painel Inicial -->
  <div class="join-panel">
    <label for="invite-link">Link do servidor:</label>
    <input type="text" id="invite-link" class="input-field" placeholder="Digite ou cole o link aqui...">
    
    <div class="btn-group">
      <button class="btn btn-primary" onclick="openCreateModal()">Criar Servidor</button>
      <button class="btn btn-primary" id="btn-enter" onclick="joinServer()" disabled>Entrar</button>
    </div>
  </div>

  <!-- Exemplo do Avatar de Usuário em Call -->
  <div style="margin: 20px; display: flex; align-items: center; gap: 12px;">
    <div class="avatar-container">
      <img src="https://via.placeholder.com/48" id="my-avatar" class="user-avatar" alt="Avatar">
    </div>
    <span id="user-name">Usuário</span>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();

    // Habilitar o botão 'Entrar' apenas quando houver texto no input
    const inviteInput = document.getElementById('invite-link');
    const btnEnter = document.getElementById('btn-enter');

    inviteInput.addEventListener('input', () => {
      btnEnter.disabled = inviteInput.value.trim() === '';
    });

    function joinServer() {
      const inviteCode = inviteInput.value.trim();
      alert('Buscando servidor para o convite: ' + inviteCode);
      // Fazer requisição GET /api/invites/:code para exibir preview (nome + foto) antes de aceitar
    }

    function openCreateModal() {
      alert('Abrir modal de criação de servidor');
    }

    // Detecção de Áudio Local (Harness Voice Activity Detection)
    async function initAudioDetection() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const analyzer = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        
        analyzer.fftSize = 512;
        source.connect(analyzer);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        const avatar = document.getElementById('my-avatar');

        function checkVolume() {
          analyzer.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          let average = sum / dataArray.length;

          // Limiar de fala (sensibilidade do microfone)
          if (average > 15) {
            avatar.classList.add('speaking');
            socket.emit('speaking-status', { isSpeaking: true });
          } else {
            avatar.classList.remove('speaking');
            socket.emit('speaking-status', { isSpeaking: false });
          }

          requestAnimationFrame(checkVolume);
        }

        checkVolume();
      } catch (err) {
        console.error('Erro ao acessar microfone:', err);
      }
    }

    // Inicializar verificação de áudio ao conectar
    // initAudioDetection();
  </script>
</body>
</html>
