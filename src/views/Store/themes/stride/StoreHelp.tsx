import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";
import "./checkout.css";
export default function StoreHelp() {
  const {tenant,path}=useKit();
  const support=whatsappLink(tenant.whatsapp,`Olá! Tenho uma dúvida sobre uma compra na ${tenant.name}.`);
  const policies=[{id:"entrega",title:"Entrega e retirada",text:tenant.policies?.shipping},{id:"trocas",title:"Trocas",text:tenant.policies?.exchange},{id:"devolucoes",title:"Devoluções",text:tenant.policies?.returns}];
  return <div className="sr-page sr-help"><span className="sr-eyebrow">PODE CONTAR COM A GENTE.</span><h1>ANTES, DURANTE.<br/>E DEPOIS DA COMPRA.</h1><p className="sr-data-note">Confira as informações publicadas pela loja e fale com a equipe quando precisar.</p>{policies.map(policy=><details key={policy.id} id={policy.id} open><summary>{policy.title}</summary><p>{policy.text || "A loja ainda não publicou informações detalhadas sobre este assunto. Entre em contato com a equipe antes de concluir a compra para combinar as condições."}</p></details>)}<details open><summary>Como acompanhar meu pedido?</summary><p>Ao confirmar a compra, você recebe um número de pedido e uma confirmação por e-mail. Use o link dessa mensagem para consultar os detalhes. A loja confirma o pagamento e combina a entrega ou retirada com você.</p></details><div className="sr-receipt-links">{support && <a className="sr-btn sr-btn-solid" href={support} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Falar com a loja</a>}<Link className="sr-btn sr-btn-line" to={path("/catalogo")}>Voltar à coleção <ArrowRight size={17}/></Link></div></div>;
}
