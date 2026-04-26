import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messageService } from '../services/auth';
import '../styles/messaging.css';

export default function Messaging() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetId = searchParams.get('targetId') || '';
  const targetName = searchParams.get('targetName') || targetId || 'Usuario';

  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
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

  const handleSend = async (event) => {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || !targetId) return;

    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      await messageService.sendMessage(targetId, content);
      setMessageText('');
      setSendSuccess('Mensaje enviado.');
      if (textareaRef.current) textareaRef.current.focus();
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
                <li key={msg.id || i} className="inbox-item">
                  <strong>{msg.from || msg.fromUserId || 'Desconocido'}</strong>
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
              <h2>Mensaje para {targetName}</h2>
              <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Escribe un mensaje para ${targetName}...`}
                  disabled={sending}
                  maxLength={2000}
                />
                {sendError ? <p className="error-text" style={{ margin: 0 }}>{sendError}</p> : null}
                {sendSuccess ? <p className="muted" style={{ margin: 0, color: '#166534' }}>{sendSuccess}</p> : null}
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
