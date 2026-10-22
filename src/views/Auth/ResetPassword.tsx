import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import PasswordRecoveryLayout from "./PasswordRecoveryLayout";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (password.length < 6) { setError("A senha deve ter no mínimo 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem. Confira e tente novamente."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Não foi possível redefinir a senha. Solicite um novo link e tente novamente."); return; }
      setDone(true);
      setPassword(""); setConfirm("");
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally { setLoading(false); }
  }

  return <PasswordRecoveryLayout step="reset">
    {done ? <div role="status" aria-live="polite">
      <div className="ar-card-icon is-success"><Check size={23} /></div>
      <h2>Sua senha foi atualizada</h2>
      <p className="ar-lead">Tudo pronto. Agora você pode entrar na sua conta com a nova senha.</p>
      <Link className="ar-primary" to="/login">Ir para o login<ArrowRight size={16} /></Link>
    </div> : <>
      <div className="ar-card-icon"><KeyRound size={23} /></div>
      <h2>Crie sua nova senha</h2>
      <p className="ar-lead">Escolha uma senha que só você conhece para voltar a acessar sua conta.</p>
      <form className="ar-form" onSubmit={handleSubmit} aria-busy={loading}>
        <div>
          <label htmlFor="new-password">Nova senha</label>
          <div className="ar-field"><LockKeyhole size={17} /><input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite sua nova senha" aria-describedby="password-hint" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={loading} /><button type="button" aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <p className="ar-hint" id="password-hint">Use pelo menos 6 caracteres. Combine letras, números e símbolos.</p>
        </div>
        <div>
          <label htmlFor="confirm-password">Confirme a nova senha</label>
          <div className="ar-field"><LockKeyhole size={17} /><input id="confirm-password" type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="Digite a senha novamente" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} disabled={loading} /><button type="button" aria-label={showConfirm ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"} aria-pressed={showConfirm} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        </div>
        {error && <p className="ar-error" role="alert">{error}</p>}
        <button type="submit" className="ar-primary" disabled={loading}>{loading ? <><Loader2 className="ar-spin" size={17} />Salvando nova senha…</> : <>Salvar nova senha<ArrowRight size={16} /></>}</button>
      </form>
      <p className="ar-note">O link não funcionou? <Link to="/forgot-password">Solicitar um novo link</Link></p>
    </>}
  </PasswordRecoveryLayout>;
}
