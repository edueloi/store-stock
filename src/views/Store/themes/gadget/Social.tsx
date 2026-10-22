import { ArrowUpRight, Facebook, Instagram, MessageCircle } from "lucide-react";
import { socialUrl, useKit } from "./kit";

export function SocialLinks({ labels = false }: { labels?: boolean }) {
  const { tenant, waLink } = useKit();
  const links = [
    { name: "Instagram", href: socialUrl(tenant.instagram_url, "instagram"), Icon: Instagram },
    { name: "Facebook", href: socialUrl(tenant.facebook_url, "facebook"), Icon: Facebook },
    { name: "WhatsApp", href: tenant.whatsapp ? waLink() : "", Icon: MessageCircle },
  ].filter((item) => item.href);
  if (!links.length) return null;
  return <div className={`gd-social-links${labels ? " gd-social-labels" : ""}`}>
    {links.map(({ name, href, Icon }) => <a key={name} href={href} aria-label={name} target="_blank" rel="noreferrer">
      <Icon size={18} strokeWidth={1.7} />{labels && <span>{name}</span>}{labels && <ArrowUpRight size={15} />}
    </a>)}
  </div>;
}

export default function SocialSection() {
  const { tenant } = useKit();
  if (!socialUrl(tenant.instagram_url, "instagram") && !socialUrl(tenant.facebook_url, "facebook")) return null;
  return <section className="gd-wrap gd-section" data-gd-reveal aria-labelledby="gd-social-title">
    <div className="gd-social-section">
      <div className="gd-social-art" aria-hidden="true"><Instagram size={66} strokeWidth={1} /><span /><Facebook size={34} strokeWidth={1.2} /></div>
      <div><span className="gd-kicker">Vamos nos conectar</span><h2 id="gd-social-title">A próxima novidade<br />passa pelo seu feed.</h2><p>Acompanhe a {tenant.name}, descubra novidades e fique por dentro da nossa seleção de tecnologia.</p><SocialLinks labels /></div>
    </div>
  </section>;
}
