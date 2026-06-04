import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { PackingOrder } from "./packingManagement";

/**
 * Generate professional PDF packing list for B2B orders
 */
export async function generatePackingListPDF(order: PackingOrder): Promise<void> {
  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    const addText = (text: string, fontSize = 10, isBold = false, x = 20) => {
      pdf.setFontSize(fontSize);
      pdf.setFont("helvetica", isBold ? "bold" : "normal");
      pdf.text(text, x, yPosition);
      yPosition += fontSize / 2 + 2;
    };

    // Professional header
    addText(`PACKING LIST`, 18, true);
    addText(`Order ID: ${order.orderId}`, 12, true);
    addText(`Client: ${order.clientName}`, 11);
    addText(
      `Created: ${new Date(order.createdAt).toLocaleString()}`,
      9,
      false,
      20
    );
    if (order.completedAt) {
      addText(
        `Completed: ${new Date(order.completedAt).toLocaleString()}`,
        9,
        false,
        20
      );
    }

    yPosition += 8;

    // Summary section
    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalBoxes = order.boxes.length;

    pdf.setFillColor(220, 230, 245);
    pdf.rect(20, yPosition - 5, pageWidth - 40, 20, "F");
    
    addText(`SUMMARY`, 11, true);
    pdf.setFontSize(9);
    pdf.text(`Total Boxes: ${totalBoxes} | Total Items: ${totalItems} | Status: ${order.status}`, 30, yPosition);
    yPosition += 10;

    yPosition += 5;

    // Items to pack (table layout)
    addText(`ITEMS TO PACK:`, 11, true);

    const marginLeft = 20;
    const marginRight = 20;
    const colSku = 30; // mm
    const colReq = 22;
    const colPacked = 22;
    const colStatus = 28;
    const availableForName = pageWidth - marginLeft - marginRight - colSku - colReq - colPacked - colStatus - 8;

    // Header row
    pdf.setFillColor(240, 244, 255);
    pdf.rect(marginLeft, yPosition - 4, pageWidth - marginLeft - marginRight, 8, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SKU', marginLeft + 2, yPosition + 2);
    pdf.text('Item / Description', marginLeft + colSku + 4, yPosition + 2);
    pdf.text('Required', marginLeft + colSku + availableForName + 6, yPosition + 2);
    pdf.text('Packed', marginLeft + colSku + availableForName + colReq + 6, yPosition + 2);
    pdf.text('Status', marginLeft + colSku + availableForName + colReq + colPacked + 6, yPosition + 2);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    let idx = 0;
    for (const item of order.items) {
      // Skip items marked as master_box or backed_elsewhere
      if (item.itemStatus === "master_box" || item.itemStatus === "backed_elsewhere") {
        continue;
      }

      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      idx++;
      const totalPacked = order.boxes.reduce((sum, box) => {
        return sum + box.contents
          .filter(c => c.itemSku === item.sku)
          .reduce((s, c) => s + c.quantityPacked, 0);
      }, 0);
      const status = totalPacked === item.quantity ? '✓ COMPLETE' : `${totalPacked}/${item.quantity}`;

      // SKU
      pdf.text(item.sku, marginLeft + 2, yPosition + 2);

      // Item name (wrap within availableForName)
      const nameLines = pdf.splitTextToSize(`${item.name}`, availableForName);
      pdf.text(nameLines, marginLeft + colSku + 4, yPosition + 2);

      // Required
      pdf.text(String(item.quantity), marginLeft + colSku + availableForName + 6, yPosition + 2);

      // Packed
      pdf.text(String(totalPacked), marginLeft + colSku + availableForName + colReq + 6, yPosition + 2);

      // Status
      pdf.text(status, marginLeft + colSku + availableForName + colReq + colPacked + 6, yPosition + 2);

      // Advance y by number of wrapped lines
      const lineCount = Array.isArray(nameLines) ? nameLines.length : 1;
      yPosition += Math.max(6, lineCount * 4 + 2);
    }

    yPosition += 5;

    // Box details
    addText(`BOX CONTENTS:`, 11, true);

    for (const box of order.boxes) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFillColor(200, 220, 255);
      pdf.rect(20, yPosition - 3, pageWidth - 40, 7, "F");
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        `${box.boxId} - ${box.totalItems} items - Created: ${new Date(box.createdAt).toLocaleDateString()}`,
        25,
        yPosition + 2
      );
      yPosition += 10;

      for (const content of box.contents) {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");

        const boxMarginLeft = 30;
        const colSkuW = 28;
        const colQtyW = 20;
        const colUomW = 18;
        const colTimeW = 28;
        const nameAvailable = pageWidth - boxMarginLeft - colSkuW - colQtyW - colUomW - colTimeW - 40;

        // SKU
        pdf.text(content.itemSku, boxMarginLeft, yPosition + 2);

        // Name (wrapped)
        const nameLines = pdf.splitTextToSize(content.itemName, nameAvailable);
        pdf.text(nameLines, boxMarginLeft + colSkuW + 6, yPosition + 2);

        // Qty
        pdf.text(String(content.quantityPacked), boxMarginLeft + colSkuW + nameAvailable + 10, yPosition + 2);

        // UOM
        pdf.text(content.uom, boxMarginLeft + colSkuW + nameAvailable + colQtyW + 12, yPosition + 2);

        // Time and pack type on smaller font below if needed
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        const timeText = `${new Date(content.timestamp).toLocaleTimeString()} | ${content.packType} | Req: ${content.quantityRequired}`;
        const timeLines = pdf.splitTextToSize(timeText, pageWidth - boxMarginLeft - 20);
        pdf.text(timeLines, boxMarginLeft + colSkuW + 6, yPosition + 6 + (Array.isArray(nameLines) ? nameLines.length * 4 : 2));
        pdf.setTextColor(0);

        const usedLines = Math.max(Array.isArray(nameLines) ? nameLines.length : 1, Array.isArray(timeLines) ? timeLines.length : 1);
        yPosition += Math.max(6, usedLines * 5 + 2);
      }

      yPosition += 3;
    }

    // Footer
    yPosition = pageHeight - 20;
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Generated: ${new Date().toLocaleString()} | Status: ${order.status}`,
      20,
      yPosition
    );

    pdf.save(`packing-${order.orderId}-${Date.now()}.pdf`);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error("Failed to generate PDF");
  }
}

/**
 * Export packing list to professional Excel format
 */
export async function exportPackingListExcel(order: PackingOrder): Promise<void> {
  try {
    // Build a professional Excel workbook using SheetJS (xlsx)
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryAoA = [
      ["PACKING LIST EXPORT"],
      [],
      ["Order ID", order.orderId],
      ["Client Name", order.clientName],
      ["Created", new Date(order.createdAt).toLocaleString()],
      ["Status", order.status],
      ["Total Boxes", order.boxes.length],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoA);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // Items summary sheet (only packed items)
    const itemsHeader = ["SKU", "Item Name", "Pack Type", "Total Required", "Total Packed", "Status", "Item Status"];
    const itemsData = order.items
      .filter((item) => item.itemStatus !== "master_box" && item.itemStatus !== "backed_elsewhere")
      .map((item) => {
        const totalPacked = order.boxes.reduce((sum, box) => {
          return (
            sum +
            box.contents
              .filter((c) => c.itemSku === item.sku)
              .reduce((s, c) => s + c.quantityPacked, 0)
          );
        }, 0);
        const status = totalPacked === item.quantity ? "COMPLETE" : "INCOMPLETE";
        return [item.sku, item.name, item.packType, item.quantity, totalPacked, status, item.itemStatus || "packed"];
      });
    const itemsAoA = [itemsHeader, ...itemsData];
    const itemsWs = XLSX.utils.aoa_to_sheet(itemsAoA);
    XLSX.utils.book_append_sheet(wb, itemsWs, "Items Summary");

    // Box details sheet (only for boxes with packed items)
    const boxHeader = ["Box ID", "Item SKU", "Item Name", "Pack Type", "Quantity Packed", "UOM", "Required Qty", "Timestamp"];
    const boxRows: any[] = [];
    for (const box of order.boxes) {
      for (const content of box.contents) {
        // Check if this item is marked as packed (not master_box or backed_elsewhere)
        const item = order.items.find((i) => i.sku === content.itemSku);
        if (item && item.itemStatus !== "master_box" && item.itemStatus !== "backed_elsewhere") {
          boxRows.push([
            box.boxId,
            content.itemSku,
            content.itemName,
            content.packType,
            content.quantityPacked,
            content.uom,
            content.quantityRequired,
            content.timestamp,
          ]);
        }
      }
    }
    const boxAoA = [boxHeader, ...boxRows];
    const boxWs = XLSX.utils.aoa_to_sheet(boxAoA);
    XLSX.utils.book_append_sheet(wb, boxWs, "Box Contents");

    // Write workbook to binary and trigger download
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `packing-${order.orderId}-${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Excel export error:", error);
    // Fallback to CSV if xlsx failed
    try {
      let csvContent = "data:text/csv;charset=utf-8,PACKING LIST EXPORT\n";
      csvContent += `Order ID,${order.orderId}\n`;
      csvContent += `Client Name,${order.clientName}\n`;
      csvContent += `Created,${new Date(order.createdAt).toLocaleString()}\n`;
      csvContent += `Status,${order.status}\n`;
      csvContent += `Total Boxes,${order.boxes.length}\n`;
      csvContent += `\n`;
      csvContent += `ITEMS SUMMARY\n`;
      csvContent += `SKU,Item Name,Pack Type,Total Required,Total Packed,Status\n`;
      for (const item of order.items) {
        const totalPacked = order.boxes.reduce((sum, box) => {
          return sum + box.contents
            .filter((c) => c.itemSku === item.sku)
            .reduce((s, c) => s + c.quantityPacked, 0);
        }, 0);
        const status = totalPacked === item.quantity ? "COMPLETE" : "INCOMPLETE";
        const row = [item.sku, item.name, item.packType, item.quantity, totalPacked, status]
          .map((val) => `"${val}"`)
          .join(",");
        csvContent += row + "\n";
      }
      csvContent += `\n`;
      csvContent += `BOX CONTENTS DETAILS\n`;
      csvContent += `Box ID,Item SKU,Item Name,Pack Type,Quantity Packed,UOM,Required Qty,Timestamp\n`;
      for (const box of order.boxes) {
        for (const content of box.contents) {
          const row = [box.boxId, content.itemSku, content.itemName, content.packType, content.quantityPacked, content.uom, content.quantityRequired, content.timestamp]
            .map((val) => `"${val}"`)
            .join(",");
          csvContent += row + "\n";
        }
      }
      const encodedUri = encodeURI(csvContent);
      const a = document.createElement("a");
      a.setAttribute("href", encodedUri);
      a.setAttribute("download", `packing-${order.orderId}-${Date.now()}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Fallback CSV export failed:", e);
      throw new Error("Failed to export Excel/CSV");
    }
  }
}

/**
 * Generate packing summary statistics
 */
export function generatePackingSummary(order: PackingOrder): {
  totalBoxes: number;
  totalItems: number;
  itemsPerBox: Record<string, number>;
  packTypeDistribution: Record<string, number>;
} {
  const totalBoxes = order.boxes.length;
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const itemsPerBox: Record<string, number> = {};
  const packTypeDistribution: Record<string, number> = {};

  for (const box of order.boxes) {
    itemsPerBox[box.boxId] = box.totalItems;

    for (const content of box.contents) {
      packTypeDistribution[content.packType] =
        (packTypeDistribution[content.packType] || 0) + content.quantityPacked;
    }
  }

  return {
    totalBoxes,
    totalItems,
    itemsPerBox,
    packTypeDistribution,
  };
}
