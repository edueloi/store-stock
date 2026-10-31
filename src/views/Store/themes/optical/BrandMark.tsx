import { useKit } from './kit';

/** Usa a assinatura original extraída do manual, sem reconstruir o lettering. */
export function BrandMark({ placement = 'header' }: { placement?: 'header' | 'footer' }) {
  const { tenant } = useKit();
  const color = placement === 'footer' ? 'white' : 'black';
  return <span className={`ferraro-signature ferraro-signature-${placement}`}>
    <picture>
      {placement === 'header' && <source media="(max-width:760px)" srcSet={`/store-assets/ferraro/wordmark-${color}.svg`} />}
      <img src={`/store-assets/ferraro/logo-${color}.png`} alt={tenant.name} width="1234" height="725" />
    </picture>
  </span>;
}
