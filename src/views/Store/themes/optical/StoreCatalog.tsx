import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, X } from 'lucide-react';
import StoreSEO from '../../../../components/store/StoreSEO';
import { useKit } from './kit';
import { Empty, ProductCard, SearchField } from './parts';
import { CategoryPicker } from './CategoryPicker';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function StoreCatalog() {
  const { tenant, templateId, path, active, categories, hidden, wishlist, sf } = useKit();
  const urban = templateId === 'orbita';
  const ferraro = sf.brand_identity === 'ferraro';
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  const cat = Number(params.get('categoria') || params.get('cat') || 0);
  const sort = params.get('sort') || 'destaques';
  const favorites = params.get('favoritos') === '1';
  const [visible, setVisible] = useState(24);

  useEffect(() => setVisible(24), [term, cat, sort, favorites]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key === 'categoria') next.delete('cat');
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const options = useMemo(() => {
    const counts = new Map<number, number>();
    active.forEach(product => {
      if (product.category_id) counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1);
    });
    return categories.filter(category => counts.has(category.id)).map(category => ({
      id: category.id, name: category.name, count: counts.get(category.id)!,
    })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [active, categories]);

  const list = useMemo(() => {
    const out = active.filter(product => (!cat || product.category_id === cat)
      && (!favorites || wishlist.includes(product.id))
      && normalize(`${product.name} ${product.description || ''} ${product.sku || ''}`).includes(normalize(term)));
    const value = (product: typeof active[number]) => Number(product.discount_price ?? product.price);
    return out.sort(sort === 'menor' && !hidden ? (a, b) => value(a) - value(b)
      : sort === 'maior' && !hidden ? (a, b) => value(b) - value(a)
      : sort === 'nome' ? (a, b) => a.name.localeCompare(b.name, 'pt-BR')
      : (a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [active, cat, favorites, wishlist, term, sort, hidden]);

  const title = favorites ? 'Seus favoritos.' : sf.catalog_title || (urban ? 'TODAS AS ÓRBITAS.' : 'Uma armação. Infinitas versões.');
  const shown = ferraro ? list.slice(0, visible) : list;
  const current = categories.find(category => category.id === cat);

  return <div className="opt-page">
    <StoreSEO title={`${title} | ${tenant.name}`} description={sf.catalog_description || 'Explore a seleção da loja. Encontre seu próximo olhar.'} siteName={tenant.name} />
    <section className="catalog-page section">
      <div className="page-heading">
        <span className="eyebrow">{favorites ? 'SEU OLHAR, SUA SELEÇÃO' : ferraro ? 'FERRARO / EXPLORE A SELEÇÃO' : urban ? 'O PRÓXIMO MOVIMENTO É SEU' : 'ENCONTRE A SUA PERSPECTIVA'}</span>
        <h1>{title}</h1><p>{sf.catalog_description || 'Explore formas, cores e detalhes. Encontre a que conversa com você.'}</p>
      </div>
      <div className="catalog-toolbar">
        {ferraro ? <CategoryPicker options={options} selected={cat} onSelect={id => set('categoria', id ? String(id) : '')} />
          : <div className="filter-tabs" aria-label="Categoria dos produtos">
            <button type="button" className={!cat ? 'selected' : ''} aria-pressed={!cat} onClick={() => set('categoria', '')}>Ver todos</button>
            {categories.filter(category => active.some(product => product.category_id === category.id)).map(category =>
              <button type="button" key={category.id} className={cat === category.id ? 'selected' : ''} aria-pressed={cat === category.id} onClick={() => set('categoria', String(category.id))}>{category.name}</button>)}
          </div>}
        <SearchField value={term} onChange={value => set('q', value)} autoFocus={params.has('busca')} />
      </div>
      {ferraro && current && <div className="ferraro-active-filter"><span>{current.name}</span><button type="button" aria-label="Remover filtro de categoria" onClick={() => set('categoria', '')}><X size={14} /></button></div>}
      <div className="catalog-options">
        <label><input type="checkbox" checked={favorites} onChange={event => set('favoritos', event.target.checked ? '1' : '')} /> Só favoritos</label>
        <span aria-live="polite">{list.length.toLocaleString('pt-BR')} {list.length === 1 ? 'produto' : 'produtos'}</span>
        <label>Ordenar<select value={sort} onChange={event => set('sort', event.target.value)}>
          <option value="destaques">Destaques</option>
          {!hidden && <><option value="menor">Menor preço</option><option value="maior">Maior preço</option></>}
          <option value="nome">Nome A–Z</option>
        </select></label>
      </div>
      <div className="product-grid">{shown.length ? shown.map(product => <ProductCard key={product.id} product={product} />) : <Empty favorites={favorites} />}</div>
      {ferraro && visible < list.length && <div className="ferraro-load-more"><p>Mostrando {shown.length.toLocaleString('pt-BR')} de {list.length.toLocaleString('pt-BR')} produtos</p><button type="button" className="btn outline" onClick={() => setVisible(value => value + 24)}>Carregar mais produtos<ArrowDown size={17} /></button></div>}
      {(term || cat > 0 || favorites) && <Link className="text-link opt-clear" to={path('/catalogo')}>Limpar filtros e ver toda a coleção ↗</Link>}
    </section>
  </div>;
}
