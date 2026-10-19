import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, MessageCircle } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import type { Prefix } from "./shared";

/** Rodapé compartilhado: colunas com título, categorias limitadas e contato. Cada tema o veste com seu CSS. */
export default function SiteFooter({ t, tagline, showCategories = true, catalogLabel = "Todas as peças", aboutLabel = "Sobre a marca" }: { t: Prefix; tagline: string; showCategories?: boolean; catalogLabel?: string; aboutLabel?: string }) {
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className={`${t}-footer`}>
      <div className={`${t}-footer-inner`}>
        <div className={`${t}-wordmark`} aria-hidden="true">
          {tenant.name}
        </div>
        <section className={`${t}-foot-col ${t}-foot-about`}>
          <Link className={`${t}-foot-brand`} to={path()}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
            <span>{tenant.name}</span>
          </Link>
          <p>{tenant.footer_text || tenant.about_text || tagline}</p>
          <div className={`${t}-social`}>
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={19} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={19} />
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle size={19} />
              </a>
            )}
          </div>
        </section>
        <section className={`${t}-foot-col`}>
          <h2>Loja</h2>
          <Link to={path("/catalogo")}>{catalogLabel}</Link>
          <Link to={path("/sobre")}>{aboutLabel}</Link>
        </section>
        {showCategories && cats.length > 0 && (
          <section className={`${t}-foot-col`}>
            <h2>Categorias</h2>
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                {c.name}
              </Link>
            ))}
          </section>
        )}
        <section className={`${t}-foot-col`}>
          <h2>Contato</h2>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> {tenant.whatsapp}
            </a>
          )}
          {tenant.show_address && tenant.address && (
            <p>
              <MapPin size={15} /> {tenant.address}
            </p>
          )}
          {hours.length > 0 && (
            <dl className={`${t}-hours`}>
              <dt className={`${t}-hours-title`}>
                <Clock size={14} /> Horários
              </dt>
              {hours.map((h) => (
                <div key={h.day}>
                  <dt>{h.day}</dt>
                  <dd>{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
      <p className={`${t}-credit`}>
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
