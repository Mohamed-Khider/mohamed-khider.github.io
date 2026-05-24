import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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

    // Items to pack (from order)
    addText(`ITEMS TO PACK:`, 11, true);
    
    let itemIndex = 0;
    for (const item of order.items) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      itemIndex++;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      
      const totalPacked = order.boxes.reduce((sum, box) => {
        return sum + box.contents
          .filter(c => c.itemSku === item.sku)
          .reduce((s, c) => s + c.quantityPacked, 0);
      }, 0);
      
      const status = totalPacked === item.quantity ? "✓ COMPLETE" : `${totalPacked}/${item.quantity}`;
      
      pdf.text(`${itemIndex}. ${item.sku} - ${item.name}`, 30, yPosition);
      yPosition += 4;
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`Required: ${item.quantity} ${item.uom} | Type: ${item.packType} | Status: ${status}`, 35, yPosition);
      pdf.setTextColor(0);
      yPosition += 6;
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
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");

        pdf.text(`• ${content.itemSku}`, 30, yPosition);
        pdf.text(
          `${content.quantityPacked} ${content.uom} of ${content.itemName}`,
          50,
          yPosition
        );
        yPosition += 5;

        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(
          `Pack Type: ${content.packType} | Required: ${content.quantityRequired} | Time: ${new Date(content.timestamp).toLocaleTimeString()}`,
          50,
          yPosition
        );
        pdf.setTextColor(0);
        yPosition += 5;
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
    let csvContent =
      "data:text/csv;charset=utf-8,PACKING LIST EXPORT\n";
    csvContent += `Order ID,${order.orderId}\n`;
    csvContent += `Client Name,${order.clientName}\n`;
    csvContent += `Created,${new Date(order.createdAt).toLocaleString()}\n`;
    csvContent += `Status,${order.status}\n`;
    csvContent += `Total Boxes,${order.boxes.length}\n`;
    csvContent += `\n`;

    // Items summary
    csvContent += `ITEMS SUMMARY\n`;
    csvContent += `SKU,Item Name,Pack Type,Total Required,Total Packed,Status\n`;

    for (const item of order.items) {
      const totalPacked = order.boxes.reduce((sum, box) => {
        return sum + box.contents
          .filter(c => c.itemSku === item.sku)
          .reduce((s, c) => s + c.quantityPacked, 0);
      }, 0);
      
      const status = totalPacked === item.quantity ? "COMPLETE" : "INCOMPLETE";
      const row = [
        item.sku,
        item.name,
        item.packType,
        item.quantity,
        totalPacked,
        status
      ]
        .map((val) => `"${val}"`)
        .join(",");
      
      csvContent += row + "\n";
    }

    csvContent += `\n`;

    // Box details
    csvContent += `BOX CONTENTS DETAILS\n`;
    csvContent += `Box ID,Item SKU,Item Name,Pack Type,Quantity Packed,UOM,Required Qty,Timestamp\n`;

    for (const box of order.boxes) {
      for (const content of box.contents) {
        const row = [
          box.boxId,
          content.itemSku,
          content.itemName,
          content.packType,
          content.quantityPacked,
          content.uom,
          content.quantityRequired,
          content.timestamp,
        ]
          .map((val) => `"${val}"`)
          .join(",");

        csvContent += row + "\n";
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `packing-${order.orderId}-${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Excel export error:", error);
    throw new Error("Failed to export Excel");
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
