// Elements
const createLobbyBtn = document.getElementById('create-lobby');
const joinLobbyBtn = document.getElementById('join-lobby');
const hostIpInput = document.getElementById('host-ip');
const lobbySection = document.getElementById('lobby-section');
const intercomSection = document.getElementById('intercom-section');
const lobbyIdSpan = document.getElementById('lobby-id');
const leaveLobbyBtn = document.getElementById('leave-lobby');
const muteBtn = document.getElementById('mute-btn');
const unmuteBtn = document.getElementById('unmute-btn');
const remoteAudio = document.getElementById('remoteAudio');
const userList = document.getElementById('user-list');
const hostIpInfo = document.getElementById('host-ip-info');
const hostIpDisplay = document.getElementById('host-ip-display');
const lobbyError = document.getElementById('lobby-error');

let localStream = null;
let peerConnection = null;
let signalingSocket = null;
let isHost = false;
let username = '';

function promptUsername() {
  let name = prompt('Enter your name:', 'User');
  if (!name) name = 'User';
  return name;
}

// --- Signaling ---
function connectSignalingServer(host) {
  // Connect to local signaling server (WebSocket)
  signalingSocket = new WebSocket(`ws://${host}:3000`);
  signalingSocket.onopen = () => {
    console.log('Connected to signaling server');
    username = promptUsername();
    sendSignalingMessage({ type: 'join', username });
  };
  signalingSocket.onmessage = handleSignalingMessage;
  signalingSocket.onerror = (e) => alert('Signaling server error: ' + e.message);
  signalingSocket.onclose = () => alert('Signaling server closed');
}

function handleSignalingMessage(event) {
  const data = JSON.parse(event.data);
  // Handle offer/answer/ice
  if (data.type === 'offer') {
    handleOffer(data.offer);
  } else if (data.type === 'answer') {
    handleAnswer(data.answer);
  } else if (data.type === 'ice') {
    handleRemoteICE(data.candidate);
  } else if (data.type === 'userlist') {
    updateUserList(data.users);
    return;
  }
}

function sendSignalingMessage(msg) {
  signalingSocket.send(JSON.stringify(msg));
}

// --- WebRTC ---
async function startLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
}

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection();
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({ type: 'ice', candidate: event.candidate });
    }
  };
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

async function handleOffer(offer) {
  await createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  sendSignalingMessage({ type: 'answer', answer });
}

async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function handleRemoteICE(candidate) {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function updateUserList(users) {
  userList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    userList.appendChild(li);
  });
}

// --- UI Logic ---
createLobbyBtn.onclick = async () => {
  isHost = true;
  lobbyIdSpan.textContent = 'Host';
  lobbySection.style.display = 'none';
  intercomSection.style.display = 'block';
  hostIpInfo.style.display = 'block';
  lobbyError.textContent = '';
  // Fetch and display host IP
  try {
    const res = await fetch('http://localhost:3001/ip');
    const data = await res.json();
    hostIpDisplay.textContent = data.ip;
  } catch (e) {
    hostIpDisplay.textContent = 'Unknown (IP server not running)';
  }
  await startLocalStream();
  await createPeerConnection();
  connectSignalingServer('0.0.0.0'); // Listen on all interfaces
  // Host waits for offer from client
};

joinLobbyBtn.onclick = async () => {
  const hostIp = hostIpInput.value.trim();
  if (!hostIp) return alert('Enter host IP');
  isHost = false;
  lobbyIdSpan.textContent = 'Client';
  lobbySection.style.display = 'none';
  intercomSection.style.display = 'block';
  hostIpInfo.style.display = 'none';
  lobbyError.textContent = '';
  await startLocalStream();
  await createPeerConnection();
  try {
    await connectSignalingServerWithError(hostIp);
  } catch (e) {
    lobbyError.textContent = 'Failed to connect to lobby. Please check the IP and try again.';
    intercomSection.style.display = 'none';
    lobbySection.style.display = 'flex';
    return;
  }
  // Client creates offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignalingMessage({ type: 'offer', offer });
};

async function connectSignalingServerWithError(host) {
  return new Promise((resolve, reject) => {
    signalingSocket = new WebSocket(`ws://${host}:3000`);
    signalingSocket.onopen = () => {
      username = promptUsername();
      sendSignalingMessage({ type: 'join', username });
      resolve();
    };
    signalingSocket.onmessage = handleSignalingMessage;
    signalingSocket.onerror = (e) => {
      reject(e);
    };
    signalingSocket.onclose = () => {
      // Only show error if not intentionally closed
    };
  });
}

leaveLobbyBtn.onclick = () => {
  if (peerConnection) peerConnection.close();
  if (signalingSocket) signalingSocket.close();
  intercomSection.style.display = 'none';
  lobbySection.style.display = 'flex';
};

muteBtn.onclick = () => {
  localStream.getAudioTracks()[0].enabled = false;
  muteBtn.style.display = 'none';
  unmuteBtn.style.display = 'inline-block';
};
unmuteBtn.onclick = () => {
  localStream.getAudioTracks()[0].enabled = true;
  muteBtn.style.display = 'inline-block';
  unmuteBtn.style.display = 'none';
}; 
