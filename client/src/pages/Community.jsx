import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { userService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/community.css';

function mapUserRow(raw) {
  const user = raw?.data || raw;
  if (!user) return null;
  return {
    id: String(user.id || user.username || ''),
    username: String(user.username || user.id || ''),
    fullName: String(user.name || user.fullName || user.username || user.id || 'Usuario'),
    avatar: user.picPath || user.avatar || ''
  };
}

export default function Community() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [friendIds, setFriendIds] = useState(new Set());
  const [pendingId, setPendingId] = useState(null);
  const [friendMsg, setFriendMsg] = useState('');

  const currentUser = getSessionUser() || {};
  const selectedId = searchParams.get('userId');

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersResponse, friendsResponse] = await Promise.all([
          userService.searchUsers(''),
          currentUser.id ? userService.getFriends(currentUser.id) : Promise.resolve(null)
        ]);

        const responseData = usersResponse?.data?.data;
        const raw = Array.isArray(responseData)
          ? responseData
          : (Array.isArray(responseData?.data) ? responseData.data : []);
        setUsers(raw.map(mapUserRow).filter(Boolean));

        const rawFriends = friendsResponse?.data?.friends;
        if (Array.isArray(rawFriends)) {
          setFriendIds(new Set(rawFriends.map((f) => String(f.id || f.userId || f))));
        }
      } catch {
        setUsers([]);
        setError('No fue posible cargar usuarios desde backend.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (String(u.id) === String(currentUser.id || currentUser.username || '')) return false;
      if (!q) return true;
      return `${u.username} ${u.fullName}`.toLowerCase().includes(q);
    });
  }, [users, query, currentUser]);

  const selectedUser = filteredUsers.find((u) => String(u.id) === String(selectedId)) || filteredUsers[0] || null;

  return (
    <div className="social-page">
      <section className="social-hero">
        <div>
          <span className="social-kicker">Comunidad</span>
          <h1>Usuarios del sistema</h1>
          <p>Vista conectada al backend sin almacenamiento local en frontend.</p>
        </div>
        <div className="social-hero-actions">
          <Link to="/social/messages" className="btn-secondary social-inline-btn">Mensajes</Link>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="social-layout">
        <aside className="social-sidebar-card">
          <div className="social-sidebar-header">
            <h2>Buscar usuarios</h2>
            <span className="social-pill">{filteredUsers.length}</span>
          </div>
          <label className="social-search-box" htmlFor="community-search">
            <input
              id="community-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por username o nombre"
            />
          </label>

          <div className="social-user-list">
            {loading ? <p className="muted">Cargando...</p> : null}
            {!loading && filteredUsers.length === 0 ? <p className="muted">No hay usuarios para mostrar.</p> : null}
            {!loading && filteredUsers.map((user) => (
              <article key={user.id} className={`social-user-card ${selectedUser?.id === user.id ? 'active' : ''}`}>
                <Link className="social-user-card-main" to={`/social?userId=${encodeURIComponent(user.id)}`}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={`Avatar de ${user.username}`} className="social-avatar" />
                  ) : (
                    <div className="social-avatar social-avatar-fallback">{user.fullName.slice(0, 1).toUpperCase()}</div>
                  )}
                  <div>
                    <h3>{user.fullName}</h3>
                    <p>@{user.username}</p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </aside>

        <main className="social-detail-card">
          {!selectedUser ? (
            <p className="muted">Selecciona un usuario para ver su detalle.</p>
          ) : (
            <>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} alt={`Avatar de ${selectedUser.username}`} className="social-avatar social-avatar-large" />
              ) : (
                <div className="social-avatar social-avatar-large social-avatar-fallback">{selectedUser.fullName.slice(0, 1).toUpperCase()}</div>
              )}
              <h2>{selectedUser.fullName}</h2>
              <p>@{selectedUser.username}</p>

              {String(selectedUser.id) !== String(currentUser.id || currentUser.username || '') ? (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                  {friendIds.has(String(selectedUser.id)) ? (
                    <span className="btn-secondary social-inline-btn friend-active" aria-label="Ya son amigos">✓ Amigos</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary social-inline-btn"
                      disabled={pendingId === selectedUser.id}
                      onClick={async () => {
                        setPendingId(selectedUser.id);
                        setFriendMsg('');
                        try {
                          await userService.sendFriendRequest(selectedUser.id);
                          setFriendIds((prev) => new Set([...prev, String(selectedUser.id)]));
                          setFriendMsg('¡Solicitud enviada!');
                        } catch {
                          setFriendMsg('No se pudo enviar la solicitud.');
                        } finally {
                          setPendingId(null);
                        }
                      }}
                    >
                      {pendingId === selectedUser.id ? 'Enviando...' : '+ Agregar amigo'}
                    </button>
                  )}
                  {friendMsg ? <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{friendMsg}</p> : null}
                  <Link
                    to={`/social/messages?targetId=${encodeURIComponent(selectedUser.id)}&targetName=${encodeURIComponent(selectedUser.fullName)}`}
                    className="btn-secondary social-inline-btn"
                  >
                    Enviar mensaje
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </main>
      </section>
    </div>
  );
}
