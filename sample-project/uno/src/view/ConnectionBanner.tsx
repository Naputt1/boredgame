type ConnectionBannerProps = {
  connectionStatus: {
    state: string
    message?: string
  }
}

export const ConnectionBanner = ({
  connectionStatus,
}: ConnectionBannerProps) => {
  const style: React.CSSProperties = {
    padding: '6px 16px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 600,
    transition: 'opacity 0.2s',
  }

  switch (connectionStatus.state) {
    case 'connected':
      return null
    case 'reconnecting':
      return (
        <div style={{ ...style, background: '#f59e0b', color: '#1c1917' }}>
          Reconnecting
          {connectionStatus.message ? `: ${connectionStatus.message}` : '...'}
        </div>
      )
    case 'disconnected':
      return (
        <div style={{ ...style, background: '#dc2626', color: '#fef2f2' }}>
          Disconnected
          {connectionStatus.message ? `: ${connectionStatus.message}` : ''}
        </div>
      )
    default:
      return (
        <div style={{ ...style, background: '#6366f1', color: '#eef2ff' }}>
          Connecting...
          {connectionStatus.message ? ` ${connectionStatus.message}` : ''}
        </div>
      )
  }
}
