import { useGame } from "./GameProvider";

export type LobbyViewProps = {
  gameName: string;
  minPlayers: number;
  onBack: () => void;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    padding: 32,
    maxWidth: 640,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    margin: "4px 0 0"
  },
  metaRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap"
  },
  badge: {
    background: "#1f2937",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    color: "#d1d5db"
  },
  codeBadge: {
    background: "#374151",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 14,
    fontWeight: 700,
    color: "#60a5fa",
    fontFamily: "monospace",
    cursor: "pointer",
    letterSpacing: "0.05em"
  },
  section: {
    background: "#0f172a",
    border: "1px solid #374151",
    borderRadius: 12,
    padding: 20
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 12px"
  },
  playerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #1f2937"
  },
  playerName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#e5e7eb"
  },
  playerBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    background: "#374151",
    color: "#9ca3af"
  },
  hostBadge: {
    background: "#1e3a5f",
    color: "#60a5fa"
  },
  readyBadge: {
    background: "#064e3b",
    color: "#34d399"
  },
  notReadyBadge: {
    background: "#7f1d1d",
    color: "#fca5a5"
  },
  spectatorBadge: {
    background: "#451a03",
    color: "#fb923c"
  },
  slotEmpty: {
    opacity: 0.4
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap"
  },
  primaryBtn: {
    background: "#3b82f6",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer"
  },
  secondaryBtn: {
    background: "#374151",
    color: "#d1d5db",
    border: 0,
    borderRadius: 8,
    padding: "10px 20px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer"
  },
  backBtn: {
    background: "transparent",
    color: "#9ca3af",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "10px 20px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer"
  },
  disabled: {
    opacity: 0.4,
    cursor: "not-allowed"
  },
  startingOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100
  },
  startingBox: {
    background: "#0f172a",
    border: "1px solid #374151",
    borderRadius: 16,
    padding: 40,
    textAlign: "center"
  }
};

export const LobbyView = ({ gameName, minPlayers, onBack }: LobbyViewProps) => {
  const {
    roomStatus,
    roomHostId,
    roomPlayers,
    isSpectator,
    privateCode,
    connected,
    playerId,
    startGame,
    leaveRoom,
    setReady,
    setSpectate
  } = useGame();

  const isHost = playerId === roomHostId;
  const playerCount = roomPlayers.filter(p => !p.isSpectator).length;
  const allReady = roomPlayers
    .filter(p => !p.isSpectator)
    .every(p => p.isReady);
  const canStart = isHost && connected && playerCount >= minPlayers && allReady && playerCount > 0;

  const handleCopyCode = () => {
    if (privateCode) {
      navigator.clipboard.writeText(privateCode).catch(() => {});
    }
  };

  const handleLeave = () => {
    leaveRoom();
    onBack();
  };

  if (roomStatus === "starting") {
    return (
      <div style={styles.startingOverlay}>
        <div style={styles.startingBox}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
          <h2 style={{ color: "#e5e7eb", margin: 0 }}>Game starting...</h2>
          <p style={{ color: "#9ca3af", marginTop: 8 }}>Hold tight!</p>
        </div>
      </div>
    );
  }

  const maxPlayers = roomPlayers.length + 1;
  const totalSlots = Math.max(playerCount + 1, maxPlayers);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{gameName}</h1>
          <p style={styles.subtitle}>Waiting for players in the lobby</p>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.badge}>
            {playerCount}/{totalSlots} players
          </span>
          {privateCode && (
            <span style={styles.codeBadge} onClick={handleCopyCode} title="Click to copy">
              {privateCode}
            </span>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Players
          <span style={{ fontWeight: 400, marginLeft: 6, color: "#6b7280" }}>
            ({roomPlayers.length} connected)
          </span>
        </h2>
        {roomPlayers.map((slot) => (
          <div key={slot.playerId} style={styles.playerRow}>
            <span style={styles.playerName}>
              {slot.playerId === roomHostId ? "👑 " : ""}
              {slot.playerId === playerId ? "You" : slot.playerId.slice(0, 8)}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {slot.playerId === roomHostId && (
                <span style={{ ...styles.playerBadge, ...styles.hostBadge }}>Host</span>
              )}
              {slot.isSpectator && (
                <span style={{ ...styles.playerBadge, ...styles.spectatorBadge }}>Spectator</span>
              )}
              {!slot.isSpectator && (
                <span style={{ ...styles.playerBadge, ...(slot.isReady ? styles.readyBadge : styles.notReadyBadge) }}>
                  {slot.isReady ? "Ready" : "Not Ready"}
                </span>
              )}
            </div>
          </div>
        ))}
        {roomPlayers.length === 0 && (
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            No players yet. Share the room code to invite others.
          </p>
        )}
      </div>

      <div style={styles.actions}>
        {!isSpectator && (
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => {
              const slot = roomPlayers.find(p => p.playerId === playerId);
              setReady(!slot?.isReady);
            }}
          >
            {roomPlayers.find(p => p.playerId === playerId)?.isReady ? "Unready" : "Ready"}
          </button>
        )}

        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => setSpectate(!isSpectator)}
        >
          {isSpectator ? "Join as Player" : "Spectate"}
        </button>

        {isHost && (
          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              ...(canStart ? {} : styles.disabled)
            }}
            disabled={!canStart}
            onClick={startGame}
          >
            Start Game
          </button>
        )}

        <button
          type="button"
          style={styles.backBtn}
          onClick={handleLeave}
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};
