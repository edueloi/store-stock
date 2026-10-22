import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Clock, Headphones, MapPin, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { EDITORIAL_IMAGE, formatPhone, hoursRows, useGadgetMotion, useKit } from "./kit";
import SocialSection, { SocialLinks } from "./Social";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf, waLink } = useKit();
  const motion = useGadgetMotion();
  const hours = hoursRows(tenant);
  const title = sf.about_title || "Conectados ao que importa.";
  const text = tenant.about_text || `${tenant.name} reúne tecnologia selecionada com atendimento próximo e compra simples.`;
  const paras = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const address = tenant.show_address ? tenant.address : "";
  return (
    <main className="gd-page gd-about-page" ref={motion}>
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="gd-wrap gd-about-intro">
        <div className="gd-about-intro-copy">
          <span className="gd-hero-eyebrow"><span /> Prazer, somos a {tenant.name}</span>
          <h1>{title}</h1>
          <p>{tenant.hero_tagline || "Tecnologia aproxima pessoas. E uma boa experiência começa com quem entende você."}</p>
          <a className="gd-text-link" href="#gd-nossa-historia">Conheça a nossa história <ArrowDown size={17} /></a>
          <div className="gd-about-mini"><span><Zap size={18} /> Tecnologia no seu dia</span><span><Headphones size={18} /> Pessoas de verdade</span></div>
        </div>
        <div className="gd-about-visual">
          <img src={tenant.banner_url || EDITORIAL_IMAGE} alt={tenant.banner_url ? `Conheça a ${tenant.name}` : "Composição ilustrativa de notebook, fone de ouvido e smartphone"} fetchPriority="high" />
          <div className="gd-about-visual-caption"><span className="gd-float-icon"><Sparkles size={23} /></span><div><small>O futuro faz parte do presente.</small><strong>E da sua rotina também.</strong></div></div>
          {!tenant.banner_url && <span className="gd-image-label">Imagem ilustrativa</span>}
        </div>
      </section>

      <section className="gd-wrap gd-section" data-gd-reveal id="gd-nossa-historia">
        <div className="gd-about-body">
          <article className="gd-about-story">
            <span className="gd-kicker">Nossa história</span><h2>Mais conexão.<br /><span>Mais possibilidades.</span></h2>
            <div className="gd-about-text">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
            <div className="gd-about-signoff">{tenant.logo_url && <img src={tenant.logo_url} alt="" loading="lazy" />}<div><strong>{tenant.name}</strong><span>Tecnologia com atendimento próximo.</span></div></div>
          </article>
          <aside className="gd-about-card" aria-label="Contato e atendimento">
            <span className="gd-contact-icon"><MessageCircle size={25} strokeWidth={1.5} /></span>
            <span className="gd-kicker">Conte com a gente</span><h2>Uma conversa.<br />A escolha certa.</h2>
            <p>Precisa comparar modelos ou encontrar uma solução? Estamos aqui para ajudar.</p>
            {tenant.whatsapp && <a className="gd-contact-phone" href={waLink()} target="_blank" rel="noreferrer">{formatPhone(tenant.whatsapp)} <ArrowUpRight size={20} /></a>}
            {tenant.whatsapp ? <a className="gd-btn gd-btn-accent gd-btn-full" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Conversar no WhatsApp</a> : <Link className="gd-btn gd-btn-accent gd-btn-full" to={path("/catalogo")}>Explorar o catálogo <ArrowUpRight size={17} /></Link>}
            <SocialLinks labels />
            {(address || hours.length > 0) && <div className="gd-contact-details">
              {address && <div><MapPin size={18} /><div><h3>Venha nos visitar</h3><p>{address}</p><a className="gd-text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Como chegar <ArrowUpRight size={14} /></a></div></div>}
              {hours.length > 0 && <div><Clock size={18} /><div><h3>Horários de atendimento</h3><dl className="gd-about-hours">{hours.map((h) => <div key={h.day}><dt>{h.day}</dt><dd>{h.text}</dd></div>)}</dl></div></div>}
            </div>}
          </aside>
        </div>
      </section>

      <section className="gd-wrap gd-section" data-gd-reveal aria-labelledby="gd-values-title">
        <header className="gd-sec-head"><div><span className="gd-kicker">Nosso jeito de fazer</span><h2 id="gd-values-title">Tecnologia é o começo.<br />A experiência faz a diferença.</h2></div></header>
        <div className="gd-values">{[
          { Icon: Zap, number: "01", title: "Escolhas que fazem sentido", text: "Da rotina de trabalho ao seu momento de lazer: descubra possibilidades para o que você precisa." },
          { Icon: Headphones, number: "02", title: "Atendimento próximo", text: "Converse, tire dúvidas e compare opções. A melhor escolha é aquela que funciona para você." },
          { Icon: ShieldCheck, number: "03", title: "Clareza em cada detalhe", text: "Informações sobre produtos, disponibilidade e condições de compra para decidir com tranquilidade." },
        ].map(({ Icon, number, title: name, text: description }) => <article key={number}><div><Icon size={26} strokeWidth={1.4} /><span>{number}</span></div><h3>{name}</h3><p>{description}</p></article>)}</div>
      </section>
      <SocialSection />
      <section className="gd-wrap gd-section" data-gd-reveal><div className="gd-about-final"><span className="gd-kicker">Seu próximo passo</span><h2>Pronto para se conectar<br />a novas possibilidades?</h2><Link className="gd-btn gd-btn-accent" to={path("/catalogo")}>Conhecer os produtos <ArrowUpRight size={18} /></Link></div></section>
    </main>
  );
}
