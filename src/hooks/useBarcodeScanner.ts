import { useEffect, useRef } from "react";

/**
 * Um campo de busca visível que pode receber a sequência de teclas de um
 * scanner físico enquanto ela ainda não decidiu seu destino final (ver
 * `activeSearchField` dentro do hook). Cada campo expõe seu valor atual via
 * `getValue` (lido por ref internamente, sem precisar entrar no array de
 * dependências de nada) e como atualizá-lo via `setValue`.
 */
export interface BarcodeScannerSearchField {
  /** Precisa bater com o atributo `id` do elemento no DOM. */
  id: string;
  getValue: () => string;
  setValue: (value: string) => void;
}

export interface UseBarcodeScannerOptions {
  /** Disparado com o código completo (já trimado) quando uma sequência de
   * scanner válida (>=3 caracteres) é concluída via Enter ou timeout de
   * 300ms sem nova tecla. */
  onScan: (code: string) => void;
  /** Desliga o listener por completo (ex.: enquanto um modal está aberto por
   * cima da tela e já tem seu próprio campo de barcode funcionando). Default
   * true. */
  enabled?: boolean;
  /** Campos de busca visíveis que podem receber o buffer da sequência atual
   * em vez de um buffer solto — cada um deve ter overlap zero com os demais
   * (o primeiro com foco decide o destino da sequência inteira). Opcional:
   * quando omitido, toda sequência detectada vai só pro buffer solto e chega
   * via onScan, sem tocar em nenhum campo da tela. */
  searchFields?: BarcodeScannerSearchField[];
  /** Ref de um input oculto controlado (normalmente `opacity-0 w-0 h-0
   * pointer-events-none`) para onde o foco é redirecionado quando a
   * sequência vai pro buffer solto (nenhum searchField em foco) — evita que
   * o foco fique em outro elemento clicável no meio da leitura. Opcional. */
  hiddenInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Mantém o `value` controlado de `hiddenInputRef` sincronizado com o
   * buffer a cada tecla capturada (o hook faz `e.preventDefault()`, então a
   * digitação nativa nunca escreve nele sozinha). Necessário sempre que
   * `hiddenInputRef` aponta pra um input controlado por React (`value={...}`)
   * — sem isso o React re-renderiza o input com o valor antigo por cima do
   * que foi digitado. Ignorado se `hiddenInputRef` não for passado. */
  setHiddenValue?: (value: string) => void;
}

/**
 * Detecta um leitor de código de barras físico (USB, simula teclado) pela
 * VELOCIDADE entre teclas: gap entre teclas < 80ms é scanner, digitação
 * humana é mais lenta. Captura a sequência inteira de dígitos e dispara
 * `onScan` quando recebe Enter ou após 300ms de timeout sem nova tecla.
 *
 * Extraído do listener original do PDV (src/views/Dashboard/PDV.tsx) para
 * reaproveitar a mesma lógica em outras telas (ex.: Catálogo) sem duplicar o
 * código pixel a pixel.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  searchFields,
  hiddenInputRef,
  setHiddenValue,
}: UseBarcodeScannerOptions) {
  // Refs (não state) pra ler o valor atual de onScan/searchFields de dentro
  // do efeito sem precisar deles no array de dependências. Tê-los como
  // dependência fazia o efeito inteiro desmontar/remontar a CADA tecla
  // digitada (porque a própria captura chama os setValue dos campos a cada
  // tecla) — isso recriava buffer/timer do zero no meio de uma leitura em
  // andamento, deixando o timer antigo (não cancelado pelo cleanup) pendente
  // e disparando onScan uma segunda vez além do Enter que finaliza a
  // leitura, duplicando o produto.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const searchFieldsRef = useRef(searchFields);
  searchFieldsRef.current = searchFields;
  const setHiddenValueRef = useRef(setHiddenValue);
  setHiddenValueRef.current = setHiddenValue;

  useEffect(() => {
    if (!enabled) return;

    let lastKeyTime = 0;
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Guarda em qual campo de busca visível a sequência de SCANNER atual
    // começou (não usado pra digitação humana normal, que o próprio onChange
    // do input já resolve sozinho) — precisa limpar esse mesmo campo ao
    // concluir o scan (Enter ou timeout), senão o código digitado fica preso
    // ali em vez de ir pro onScan.
    //
    // "pending" = ainda não decidiu pra onde vai a sequência atual (nenhuma
    // tecla de scanner capturada ainda); null = decidiu que vai pro buffer
    // solto (nenhum campo de busca visível), não pra um campo da tela.
    const PENDING = "pending" as const;
    let activeSearchField: BarcodeScannerSearchField | null | typeof PENDING = PENDING;

    const resolvedField = (f: typeof activeSearchField): BarcodeScannerSearchField | null =>
      f === PENDING ? null : f;

    const clearActiveSearchField = () => {
      resolvedField(activeSearchField)?.setValue("");
      activeSearchField = PENDING;
    };

    const flush = (code: string) => {
      buffer = "";
      if (timer) { clearTimeout(timer); timer = null; }
      clearActiveSearchField();
      if (code.trim().length >= 3) onScanRef.current(code.trim());
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = (active?.tagName ?? "").toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || tag === "select";
      const activeId = active instanceof HTMLElement ? active.id : "";
      const matchedField = (searchFieldsRef.current ?? []).find((f) => f.id === activeId) ?? null;

      const now = Date.now();
      const gap = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          e.preventDefault();
          flush(buffer);
        }
        return;
      }

      if (e.key.length !== 1) return;

      // Campo de scan oculto já focado ANTES da sequência atual começar (não
      // foi este handler quem deu o .focus() nele) -> deixa o onChange nativo
      // dele cuidar sozinho, como sempre foi.
      if (hiddenInputRef?.current && active === hiddenInputRef.current && activeSearchField === PENDING) return;

      // Só intercepta teclas rápidas demais pra serem digitação humana
      // (leitor físico) — isso vale TANTO dentro quanto fora dos campos de
      // busca. Sem essa checagem de velocidade, digitar normalmente (devagar)
      // num campo de busca era sequestrado tecla a tecla por este handler
      // (com preventDefault, então o onChange nativo nunca rodava) e todo
      // texto digitado sumia sozinho 300ms depois de qualquer pausa — o
      // timer de flush limpava o campo achando que era um código de barras
      // incompleto.
      //
      // Mas se não há nenhum campo editável em foco (clicou em botão, área
      // neutra da tela, ou nada mesmo) e ainda não decidimos o destino, não
      // existe digitação humana pra proteger ali — captura a sequência
      // inteira desde a 1ª tecla, senão o primeiro dígito bipado
      // (frequentemente "7", prefixo comum de EAN-13 brasileiro) vaza solto.
      //
      // Uma vez que a sequência já decidiu pra onde vai (activeSearchField
      // != "pending"), essa checagem não pode mais barrar as teclas
      // seguintes, senão o foco mudando no meio (ex.: o .focus() do campo de
      // scan oculto, logo abaixo) faz a leitura ser cortada pela metade.
      if (activeSearchField === PENDING && isEditable && gap > 80) return;

      // A PRIMEIRA tecla da sequência decide o destino (campo de busca visível
      // vs. buffer solto) e essa decisão fica fixa até o flush — reavaliar
      // "onde focar" tecla a tecla é frágil: o .focus() programático do campo
      // de scan oculto (usado quando não há campo de busca) muda
      // document.activeElement no meio da sequência, fazendo o resto do
      // código cair no branch errado e a leitura ser cortada pela metade.
      if (activeSearchField === PENDING) activeSearchField = matchedField;

      // Leitor detectado → captura e redireciona. Dentro de um campo de busca,
      // o buffer parte do valor atual do campo (não de ""), porque a(s)
      // tecla(s) anterior(es) da mesma sequência podem já ter passado pelo
      // onChange nativo antes da velocidade ficar rápida o bastante pra ser
      // reconhecida como scanner.
      e.preventDefault();
      const field = resolvedField(activeSearchField);
      if (buffer === "") {
        buffer = field ? field.getValue() : "";
      }
      buffer += e.key;
      if (field) field.setValue(buffer);
      else {
        hiddenInputRef?.current?.focus();
        setHiddenValueRef.current?.(buffer);
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const b = buffer;
        buffer = "";
        clearActiveSearchField();
        if (b.trim().length >= 3) onScanRef.current(b.trim());
      }, 300);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Cancela qualquer timer de flush pendente desta montagem — sem isso, se
      // o efeito remontar por qualquer outro motivo no meio de uma leitura, o
      // timer da montagem antiga ainda dispararia onScan mais tarde,
      // duplicando o produto.
      if (timer) clearTimeout(timer);
    };
    // Monta uma única vez por valor de `enabled` — onScan/searchFields são
    // lidos via ref (onScanRef/searchFieldsRef) de propósito, pra nunca
    // remontar este efeito no meio de uma leitura do scanner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
