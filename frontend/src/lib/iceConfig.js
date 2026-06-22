// WebRTC ICE servers. STUN works on most networks; add a TURN server (via Vite
// env) for clients behind symmetric NATs where STUN alone can't connect.
//   VITE_TURN_URL=turn:turn.example.com:3478
//   VITE_TURN_USERNAME=...   VITE_TURN_CREDENTIAL=...
const turnUrl = import.meta.env.VITE_TURN_URL;

export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(turnUrl
    ? [
        {
          urls: turnUrl,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];
