import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Heart, MapPin, MessageCircle, Wine } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { BRISA_MOMENT } from "./Hero";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, sf, path } = useKit();
  const title = sf.about_title || "Bons momentos são feitos para compartilhar.";
  const about = tenant.about_text || "Somos uma adega para quem gosta de reunir pessoas, descobrir sabores e celebrar os pequenos momentos. Nossa seleção acompanha o almoço em família, a conversa entre amigos e as ocasiões que merecem um brinde especial.";
  const photo = tenant.banner_url || sf.hero_slides?.[1]?.image || sf.hero_slides?.[0]?.image || BRISA_MOMENT;
  const wa = whatsappLink(tenant.whatsapp, `Olá! Gostaria de conhecer melhor a ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours);
  const address = tenant.show_address && tenant.address;
  return <div className="brs-page"><StoreSEO title={`${sf.about_title || "Nossa história"} | ${tenant.name}`} description={about} image={photo} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} /><section className="brs-wrap brs-about-hero"><div><span className="brs-kicker"><Heart size={13} /> Muito prazer, {tenant.name}</span><h1>{title}</h1><p className="brs-pre">{about}</p><Link className="brs-btn" to={path("/catalogo")}>Conheça nossa seleção <ArrowUpRight size={16} /></Link></div><div className="brs-about-photo"><img src={photo} alt={`Um convite para conhecer a ${tenant.name}`} /><span><Wine size={20} strokeWidth={1.2} /> Bebidas & boas histórias.</span></div></section>
    <section className="brs-wrap brs-section"><div className="brs-about-values"><div><span className="brs-kicker">O que nos aproxima</span><h2>Um jeito leve<br />de celebrar a vida.</h2></div><article><Wine size={24} strokeWidth={1.2} /><h3>Sabores para descobrir</h3><p>Uma seleção para diferentes gostos e ocasiões.</p></article><article><MessageCircle size={24} strokeWidth={1.2} /><h3>Conversa de verdade</h3><p>Fale com nossa equipe para tirar suas dúvidas e escolher seu pedido.</p></article></div></section>
    <section className="brs-wrap brs-section brs-about-info">{(wa || address || hours.length > 0) && <article><span className="brs-kicker">Estamos por aqui</span><h2>Vamos nos encontrar?</h2>{address && <p><MapPin size={17} />{tenant.address}</p>}{address && <a className="brs-text-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address || "")}`} target="_blank" rel="noreferrer">Ver no mapa <ArrowUpRight size={15} /></a>}{wa && <a className="brs-text-link" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />{tenant.whatsapp}</a>}{hours.map((hour) => <p key={hour.day}><Clock3 size={15} /><b>{hour.day}</b> {hour.text}</p>)}</article>}{(tenant.policies?.shipping || tenant.policies?.returns || tenant.policies?.exchange) && <article><span className="brs-kicker">Tudo combinado</span><h2>Detalhes que importam</h2>{tenant.policies.shipping && <div><h3>Entrega</h3><p className="brs-pre">{tenant.policies.shipping}</p></div>}{tenant.policies.returns && <div><h3>Trocas e devoluções</h3><p className="brs-pre">{tenant.policies.returns}</p></div>}{tenant.policies.exchange && <div><h3>Política de troca</h3><p className="brs-pre">{tenant.policies.exchange}</p></div>}</article>}</section>
  </div>;
}
