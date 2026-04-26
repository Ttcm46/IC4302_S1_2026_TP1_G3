import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messageService } from '../services/auth';
import { getSessionUser } from '../services/session';
import '../styles/messaging.css';

export default function Messaging() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = getSessionUser() || {};

  const targetId = searchParams.get('targetId') || '';
  const targetName = searchParams.get('targetName') || targetId || 'Usuario';

  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [conversation, setConversation] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const conversationEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const loadInbox = async () => {
      setInboxLoading(true);
      try {
        const response = await messageService.getInbox();
        const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
        setInbox(messages);
      } catch {
        setInbox([]);
      } finally {
        setInboxLoading(false);
      }
    };
    loadInbox();
  }, []);

  useEffect(() => {
    if (!targetId) return;
    const loadConversation = async () => {
      setConvLoading(true);
      try {
        const response = await messageService.getConversation(targetId);
        const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
        setConversation(messages);
      } catch {
        setConversation([]);
      } finally {
        setConvLoading(false);
      }
    };
    loadConversation();
  }, [targetId]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSend = async (event) => {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || !targetId) return;

    setSending(true);
    setSendError('');
    try {
      await messageService.sendMessage(targetId, content);
      setMessageText('');
      if (textareaRef.current) textareaRef.current.focus();
      // Reload conversation thread
      const response = await messageService.getConversation(targetId);
      const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      setConversation(messages);
    } catch {
      setSendError('No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="direct-page">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate('/social')}
      >
        ← Volver a comunidad
      </button>

      <section className="direct-layout">
        <aside className="direct-inbox-card">
          <h2>Bandeja de entrada</h2>
          {inboxLoading ? (
            <p className="muted">Cargando...</p>
          ) : inbox.length === 0 ? (
            <p className="muted">No hay mensajes.</p>
          ) : (
            <ul className="inbox-list">
              {inbox.map((msg, i) => (
                <li key={msg._id || msg.id || i} className="inbox-item">
                  <strong>{msg.fromUserId || msg.from || 'Desconocido'}</strong>
                  <p>{msg.content || msg.text || ''}</p>
                  {msg.createdAt ? <span className="muted" style={{ fontSize: '0.78rem' }}>{new Date(msg.createdAt).toLocaleString('es-CR')}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="direct-conversation-card">
          {targetId ? (
            <>
              <h2>Conversación con {targetName}</h2>

              <div className="conversation-thread" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', minHeight: '120px' }}>
                {convLoading ? (
                  <p className="muted">Cargando conversación...</p>
                ) : conversation.length === 0 ? (
                  <p className="muted">No hay mensajes en esta conversación aún.</p>
                ) : (
                  conversation.map((msg, i) => {
                    const isOwn = String(msg.fromUserId) === String(currentUser.id || currentUser.username || '');
                    return (
                      <div
                        key={msg._id || msg.id || i}
                        style={{
                          alignSelf: isOwn ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          background: isOwn ? '#4f46e5' : '#f3f4f6',
                          color: isOwn ? '#fff' : '#111',
                          borderRadius: '0.75rem',
                          padding: '0.5rem 0.875rem',
                        }}
                      >
                        <p style={{ margin: 0 }}>{msg.content}</p>
                        {msg.createdAt ? (
                          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            {new Date(msg.createdAt).toLocaleString('es-CR')}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                )}
                <div ref={conversationEndRef} />
              </div>

              <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Escribe un mensaje para ${targetName}...`}
                  disabled={sending}
                  maxLength={2000}
                />
                {sendError ? <p className="error-text" style={{ margin: 0 }}>{sendError}</p> : null}
                <button type="submit" className="btn-primary" disabled={sending || !messageText.trim()}>
                  {sending ? 'Enviando...' : 'Enviar mensaje'}
                </button>
              </form>
            </>
          ) : (
            <p className="muted">Selecciona un usuario desde Comunidad o un curso para iniciar una conversación.</p>
          )}
        </main>
      </section>
    </div>
  );
}
