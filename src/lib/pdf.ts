export async function downloadHtmlAsPdf(html: string, filename: string) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
  document.body.appendChild(container);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "width:794px;height:0;border:none;display:block;";
  container.appendChild(iframe);
  try {
    const idoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!idoc) throw new Error("Não foi possível preparar o documento");
    idoc.open();
    idoc.write(html);
    idoc.close();

    await new Promise((resolve) => setTimeout(resolve, 250));
    const targetBody = idoc.body;
    iframe.style.height = `${targetBody.scrollHeight}px`;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(targetBody, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
    } else {
      let remaining = canvas.height;
      let position = 0;
      const pageCanvasH = (pageH * canvas.width) / imgW;
      while (remaining > 0) {
        const sliceH = Math.min(pageCanvasH, remaining);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, position, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (position > 0) pdf.addPage();
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, imgW, (sliceH * imgW) / canvas.width);
        position += sliceH;
        remaining -= sliceH;
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
