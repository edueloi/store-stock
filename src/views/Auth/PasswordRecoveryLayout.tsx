import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import "./password-recovery.css";

function RecoveryBrand() {
  return <div className="ar-brand"><img src="/system/favicon.png" alt="" width="44" height="44" /><span><b>Store</b> BoxSys<small>Gestão para o seu negócio</small></span></div>;
}

export default function PasswordRecoveryLayout({ step, children }: { step: "request" | "reset"; children: ReactNode }) {
  return <div className="ar-page">
    <aside className="ar-aside">
      <RecoveryBrand />
      <div className="ar-story">
        <div className="ar-mark"><img src="/system/favicon.png" alt="" width="126" height="126" /></div>
        <p className="ar-eyebrow">Sua conta, sempre com você</p>
        <h1>{step === "request" ? <>Vamos recuperar<br />seu <em>acesso.</em></> : <>Uma nova senha.<br />O mesmo <em>negócio.</em></>}</h1>
        <p>Em poucos passos, você volta a cuidar da sua loja com tudo no lugar.</p>
        <ol className="ar-steps" aria-label="Etapas da recuperação">
          <li className={step === "request" ? "is-current" : "is-complete"} aria-current={step === "request" ? "step" : undefined}><span>{step === "reset" ? <Check size={14} /> : "1"}</span>Seu e-mail</li>
          <li className={step === "reset" ? "is-current" : ""} aria-current={step === "reset" ? "step" : undefined}><span>2</span>Nova senha</li>
          <li><span>3</span>Pronto para entrar</li>
        </ol>
      </div>
      <p className="ar-aside-footer">© {new Date().getFullYear()} Store BoxSys</p>
    </aside>
    <main className="ar-main">
      <div className="ar-mobile-brand"><RecoveryBrand /></div>
      <div className="ar-form-wrap">
        <Link className="ar-back" to="/login"><ArrowLeft size={16} />Voltar ao login</Link>
        <section className="ar-card" aria-label={step === "request" ? "Recuperação de acesso" : "Redefinição de senha"}>{children}</section>
        <p className="ar-reassurance"><ShieldCheck size={15} />Seu acesso protegido em todas as etapas.</p>
      </div>
      <p className="ar-mobile-footer">© {new Date().getFullYear()} Store BoxSys</p>
    </main>
  </div>;
}
