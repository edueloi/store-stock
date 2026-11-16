; O Store BoxSys fica na bandeja do Windows (para receber impressões remotas) e ignora o
; pedido educado de fechar a janela, então o instalador padrão trava em "Não é possível
; fechar o Store BoxSys... Repetir". Aqui o app é encerrado de verdade antes de instalar.
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Sleep 1500
!macroend
