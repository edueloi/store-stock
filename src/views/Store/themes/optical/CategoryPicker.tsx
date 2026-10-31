import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

type Option = { id: number; name: string; count: number };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function CategoryPicker({ options, selected, onSelect }: {
  options: Option[];
  selected: number;
  onSelect: (id: number) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find(option => option.id === selected);
  const filtered = options.filter(option => normalize(option.name).includes(normalize(query)));

  const close = (focus = false) => {
    if (ref.current) ref.current.open = false;
    setOpen(false);
    if (focus) ref.current?.querySelector('summary')?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  const choose = (id: number) => { onSelect(id); setQuery(''); close(true); };
  return <details className="ferraro-category-picker" ref={ref} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary aria-label={`Selecionar categoria: ${current?.name || 'Todas as categorias'}`}>
      <span><small>Categoria</small><strong title={current?.name}>{current?.name || 'Todas as categorias'}</strong></span>
      <ChevronDown size={18} aria-hidden="true" />
    </summary>
    {open && <div className="ferraro-category-panel">
      <label className="ferraro-category-search"><Search size={17} aria-hidden="true" />
        <input type="search" aria-label="Buscar categoria" placeholder="Buscar categoria" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
      </label>
      <ul aria-label="Categorias do catálogo">
        <li><button type="button" aria-pressed={!selected} onClick={() => choose(0)}><span>Todas as categorias</span>{!selected && <Check size={16} />}</button></li>
        {filtered.map(option => <li key={option.id}><button type="button" aria-pressed={selected === option.id} onClick={() => choose(option.id)}>
          <span>{option.name}</span><small>{option.count.toLocaleString('pt-BR')}</small>{selected === option.id && <Check size={16} />}
        </button></li>)}
        {!filtered.length && <li className="ferraro-category-empty">Nenhuma categoria encontrada.</li>}
      </ul>
    </div>}
  </details>;
}
