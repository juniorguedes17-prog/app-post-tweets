import { DEFAULT_AVATAR_SRC } from '../../types/project'

export function TweetHeader({ avatarSrc }: { avatarSrc?: string }) {
  return <header className="tweet-header">
    <div className="avatar-wrap"><img src={avatarSrc || DEFAULT_AVATAR_SRC} alt="Paulo Afonso" /></div>
    <div className="identity"><div className="profile-name">Paulo Afonso | iPhone • iPad • <span className="no-break">MacBook</span><img className="badge" src="/assets/verified-badge.svg" alt="Verificado" /></div><div className="handle">@inest_phone</div></div>
  </header>
}
