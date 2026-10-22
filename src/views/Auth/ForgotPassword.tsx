import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import PasswordRecoveryLayout from "./PasswordRecoveryLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        setError("Não foi possível solicitar o link agora. Tente novamente em instantes.");
        return;
      }
      setSent(true);
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally { setLoading(false); }
  }

  return <PasswordRecoveryLayout step="request">
    {sent ? <div role="status" aria-live="polite">
      <div className="ar-card-icon is-success"><Check size={23} /></div>
      <h2>Confira seu e-mail</h2>
      <p className="ar-lead">Se <strong>{email.trim()}</strong> estiver cadastrado, você receberá um link para criar uma nova senha.</p>
      <div className="ar-info"><strong>Não encontrou a mensagem?</strong>Espere alguns instantes e confira também a pasta de spam ou lixo eletrônico. O link é válido por 1 hora.</div>
      <div className="ar-success-actions">
        <Link className="ar-primary" to="/login">Voltar ao login<ArrowRight size={16} /></Link>
        <button className="ar-secondary" type="button" onClick={() => { setSent(false); setError(""); }}>Usar outro e-mail</button>
      </div>
    </div> : <>
      <div className="ar-card-icon"><Mail size={23} /></div>
      <h2>Esqueceu a senha?</h2>
      <p className="ar-lead">Acontece. Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.</p>
      <form className="ar-form" onSubmit={handleSubmit} aria-busy={loading}>
        <div>
          <label htmlFor="recovery-email">E-mail da sua conta</label>
          <div className="ar-field"><Mail size={17} /><input id="recovery-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} /></div>
        </div>
        {error && <p className="ar-error" role="alert">{error}</p>}
        <button className="ar-primary" type="submit" disabled={loading}>{loading ? <><Loader2 className="ar-spin" size={17} />Enviando link…</> : <>Enviar link de recuperação<ArrowRight size={16} /></>}</button>
      </form>
      <p className="ar-note">Você receberá as instruções por e-mail. O link de recuperação é válido por 1 hora.</p>
    </>}
  </PasswordRecoveryLayout>;
}
