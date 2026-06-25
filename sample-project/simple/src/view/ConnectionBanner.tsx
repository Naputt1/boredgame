import type { ConnectionStatus } from '@boredgame/react'

type Props = {
  connectionStatus: ConnectionStatus
}

const bannerConfig: Record<string, { label: string; className: string }> = {
  connecting: { label: 'Connecting…', className: 'banner-connecting' },
  connected: { label: 'Connected', className: 'banner-connected' },
  reconnecting: { label: 'Reconnecting…', className: 'banner-reconnecting' },
  disconnected: { label: 'Disconnected', className: 'banner-disconnected' },
}

export const ConnectionBanner = ({ connectionStatus }: Props) => {
  const cfg = bannerConfig[connectionStatus.state] ?? bannerConfig.disconnected

  return (
    <div className={`connection-banner ${cfg.className}`}>
      <span className="connection-dot" />
      <span>{cfg.label}</span>
      {connectionStatus.lastError && (
        <span className="connection-error">
          ({connectionStatus.lastError.code}:{' '}
          {connectionStatus.lastError.message})
        </span>
      )}
    </div>
  )
}
