; O Store BoxSys fica na bandeja do Windows (para receber impressões remotas) e ignora o
; pedido educado de fechar a janela, então o instalador padrão travava em "Não é possível
; fechar o Store BoxSys... Repetir". Aqui o app é encerrado de verdade antes de instalar.
;
; ATENÇÃO: NÃO usar "taskkill /T". Numa atualização automática o instalador é processo FILHO
; do app; o /T encerra também os filhos, ou seja, o instalador matava a si mesmo no meio da
; instalação (o app reabria e pedia a atualização de novo, em ciclo). Todos os processos do
; Electron têm o mesmo nome de executável, então "/F /IM" já encerra todos eles sem o /T.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Sleep 2000
!macroend
