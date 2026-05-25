// ==========================================
// PDF-ENGINE.JS v2.0
// Suporte para Origem/Destino
// ==========================================

function gerarPDF(d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Recupera dados globais da sessão
    const veiculoPlaca = localStorage.getItem("veiculo_atual") || "S/P";
    const modeloVeiculo = localStorage.getItem("modelo_veiculo") || "Veículo";

    // 1. Cabeçalho Estilizado
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FOR 181 - INSPEÇÃO DE VEÍCULO v2.0", 105, 13, { align: "center" });

    // 2. Informações de Identificação
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO INSPETOR E VEÍCULO", 14, 28);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Inspetor: ${d.motorista_nome.toUpperCase()} | CPF/Matrícula: ${d.matricula}`, 14, 34);
    doc.text(`Veículo: ${modeloVeiculo} (${veiculoPlaca}) | KM: ${d.km}`, 14, 40);
    doc.text(`Data/Hora: ${d.data_hora}`, 14, 46);

    // 3. NOVO: Informações de Rota
    let yPosition = 52;
    if (d.local_origem || d.local_destino) {
        doc.setFont("helvetica", "bold");
        doc.text("ROTA INFORMADA", 14, yPosition);
        doc.setFont("helvetica", "normal");
        yPosition += 6;
        
        if (d.local_origem) {
            doc.text(`Origem: ${d.local_origem}`, 14, yPosition);
            yPosition += 6;
        }
        if (d.local_destino) {
            doc.text(`Destino: ${d.local_destino}`, 14, yPosition);
            yPosition += 6;
        }
        yPosition += 2; // Espaçamento extra
    }

    // 4. Tabela de Itens de Inspeção
    const rows = Object.keys(d.itens).map((k) => [
        k,
        d.itens[k].status,
        d.itens[k].obs || "-",
    ]);

    doc.autoTable({
        head: [["Item de Inspeção", "Condição", "Observações Técnicas"]],
        body: rows,
        startY: yPosition,
        theme: "grid",
        headStyles: { 
            fillColor: [30, 41, 59], 
            fontStyle: 'bold',
            fontSize: 9
        },
        styles: { 
            fontSize: 8, 
            cellPadding: 2 
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
            2: { cellWidth: 75 }
        },
        didParseCell: (data) => {
            if (data.column.index === 1 && data.cell.raw === "RUIM") {
                data.cell.styles.textColor = [239, 68, 68];
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 1 && data.cell.raw === "OK") {
                data.cell.styles.textColor = [16, 185, 129];
            }
        },
    });

    // 5. Estatísticas Rápidas
    let countOk = 0;
    let countRuim = 0;
    Object.values(d.itens).forEach(item => {
        if (item.status === "OK") countOk++;
        else countRuim++;
    });

    const finalTableY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`✓ Itens OK: ${countOk}`, 14, finalTableY);
    doc.setTextColor(239, 68, 68);
    doc.text(`✗ Itens com Problema: ${countRuim}`, 70, finalTableY);

    // 6. Mapa de Avarias
    if (d.mapa && d.mapa.length > 1000) { 
        let mapaY = finalTableY + 10;
        
        if (mapaY > 210) {
            doc.addPage();
            mapaY = 20;
        }

        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("MAPA DE AVARIAS (LATARIA):", 14, mapaY);
        
        doc.addImage(d.mapa, "PNG", 14, mapaY + 5, 180, 70);
    }

    // 7. Rodapé de Assinatura
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.line(60, pageHeight - 20, 150, pageHeight - 20);
    doc.text(`Assinatura Eletrônica: ${d.motorista_nome}`, 105, pageHeight - 15, { align: "center" });
    doc.text("Este documento é parte integrante do sistema de gestão de frota.", 105, pageHeight - 10, { align: "center" });

    // 8. Geração do arquivo
    const timestamp = new Date().getTime();
    const fileName = `FOR181_${veiculoPlaca}_${timestamp}.pdf`;
    
    doc.save(fileName);
    console.log(`[✓] PDF gerado: ${fileName}`);
}
