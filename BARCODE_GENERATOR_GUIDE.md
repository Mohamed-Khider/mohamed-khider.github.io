# Unified Label & Barcode Generator - User Guide

## Overview

The Unified Label & Barcode Generator is a comprehensive, modern system for creating, customizing, and printing barcode labels on Zebra printers. It consolidates all barcode generation functionality into one clean, powerful interface.

## Features

### ✨ Four Generation Modes

#### 1. **Single Barcode**
- Generate one barcode label
- Perfect for individual items or SKUs
- Example: `RML-C01-S01-L1A`

#### 2. **Number Range**
- Generate sequential barcodes automatically
- Optional prefix support
- Example: Prefix `BIN-S-` from 001 to 010 generates:
  ```
  BIN-S-001
  BIN-S-002
  ...
  BIN-S-010
  ```

#### 3. **Barcode List**
- Paste multiple barcodes
- One per line or comma-separated
- Bulk import from Excel/CSV

#### 4. **Location Builder**
- Generate location-based barcodes
- Components: Warehouse, Zone, Section, Level Range
- Example: `RML-C01-S01-L1A`, `RML-C01-S01-L2A`, etc.
- Fully customizable format

### 🏷️ Label Sizes

#### **2.5" × 1" (Small Labels)**
- Compact label for bins and small items
- 1 barcode per label page
- Ideal for: shelf bins, small packages
- ZPL: 508×203 dots at 203 DPI

#### **4" × 6" (Standard Labels)**
- Industry standard label for pallets and cartons
- 4 barcodes fit per label page (2×2 grid)
- Ideal for: shipping, storage locations, large items
- ZPL: 812×1218 dots at 203 DPI

### 📊 Preview & Export

**Live Preview**
- Visual barcode rendering as you type
- See exactly what prints
- Pagination for multiple labels
- Page navigation controls

**Export Options**
1. **Print Labels**: Send to browser's print dialog (then to physical printer)
2. **Send to Zebra**: Direct network printing via printer IP address
3. **Copy ZPL**: Get raw ZPL code for manual/API use
4. **📥 PDF & Print**: 
   - Generates a multi-page PDF with proper label sizing
   - **Small labels (2.5×1)**: One label per PDF page
   - **Large labels (4×6)**: 4 labels per PDF page (2×2 grid)
   - Automatically opens browser print dialog after save
   - All pages combined into one PDF file
   - Perfect for Zebra printer alignment and printing

### 🔒 Permissions & Settings

- **Printer Access**: Requires `print_labels` permission
- **Printer IP**: Optional (uses default if not specified)
- **User Validation**: Admin can grant/revoke access

## How to Use

### Step 1: Select Generation Mode
Choose how you want to create barcodes:
- **Single**: For one item at a time
- **Range**: For sequential numbering
- **List**: For bulk import
- **Location**: For warehouse locations

### Step 2: Configure Settings
- Choose label size (2.5"×1" or 4"×6")
- Enter printer IP (optional)
- System validates permissions automatically

### Step 3: Enter Barcode Data
Depending on your mode, enter:
- **Single**: Just one code
- **Range**: Start number, end number, optional prefix
- **List**: Multiple codes (one per line or comma-separated)
- **Location**: Warehouse, Zone, Section, Level, and number range

### Step 4: Generate
Click "Generate Barcodes" button

### Step 5: Preview & Export
- Review generated barcodes
- Navigate between pages if multiple
- Choose export method:
  - Print (browser print dialog)
  - Send to Zebra (direct to printer)
  - Copy ZPL (for manual/API use)
  - Download PDF (for archiving)

## Examples

### Example 1: Location Bin Labels
```
Generation Mode: Location Builder
Warehouse: RML
Zone: C01
Section: S01
Level: A
Start: 1, End: 5

Result:
- RML-C01-S01-L1A
- RML-C01-S01-L2A
- RML-C01-S01-L3A
- RML-C01-S01-L4A
- RML-C01-S01-L5A
```

### Example 2: Sequential Bin Numbers
```
Generation Mode: Range
Prefix: BIN-S-
Start: 1, End: 10

Result:
- BIN-S-1
- BIN-S-2
- ...
- BIN-S-10
```

### Example 3: Mixed Barcodes (Bulk Import)
```
Generation Mode: List
Input:
SKU-001
SKU-002
ITEM-ABC-123
SPECIAL-XYZ

Prints all 4 unique codes
```

## 📥 PDF Export Feature

The **PDF & Print** button generates properly formatted PDFs optimized for Zebra printers:

### For Small Labels (2.5" × 1")
```
✓ Each label on its own PDF page
✓ Page size: exactly 2.5" × 1"
✓ Barcode + text centered
✓ No page breaks between labels
✓ One label = one page
```

### For Large Labels (4" × 6")
```
✓ 4 labels per PDF page (2×2 grid)
✓ Page size: exactly 4" × 6"
✓ Each barcode + text in grid cell
✓ Optimized spacing
✓ Multiple pages automatically created
```

### How It Works
1. Click **"📥 PDF & Print"** button
2. PDF generates with proper label sizing
3. Browser print dialog opens automatically
4. PDF is saved to your Downloads folder
5. Print directly from dialog to Zebra printer

### Why Use PDF Export
- **Accurate sizing**: Pages match exact label dimensions
- **Batch printing**: All labels in one file
- **Reliable layout**: No formatting issues
- **Multi-printer**: Save and print later
- **Archiving**: Keep records of all labels printed

## ZPL Output

All labels generate standard ZPL (Zebra Programming Language) code:

```zpl
^XA                    # Start label
^PW812                 # Page width
^LL1218                # Label length
^LH0,0                 # Label home
^FO50,50               # Field origin
^BCN,100,N,N,N         # Barcode config
^FD[CODE]^FS           # Field data
^XZ                    # End label
```

**Copy ZPL** to use with:
- Zebra printer APIs
- Other label software
- Custom integrations
- Manual printer configuration

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Printer not found | Check printer IP and network connection |
| No permission to print | Contact admin to enable `print_labels` permission |
| Labels not printing | Verify printer has label stock loaded |
| Preview not showing | Try refreshing page or switching label size |
| ZPL errors | Check barcode code length and special characters |

## Technical Details

### Supported Barcode Format
- **Type**: CODE128
- **Length**: 1-100 characters
- **Characters**: Alphanumeric, hyphens, underscores, dots

### ZPL Parameters
- **DPI**: 203 dots per inch (standard Zebra)
- **Encoding**: UTF-8
- **Page breaks**: Automatic between labels when needed

### File Size Limits
- Single barcode: ~500 bytes ZPL
- 100 barcodes: ~50 KB ZPL
- PDF export: Depends on image quality

## Best Practices

1. **Always preview** before printing bulk labels
2. **Test print** a sample label first
3. **Use Location Builder** for warehouse organization
4. **Name conventions**: Keep codes short, descriptive, consistent
5. **Backup**: Download PDF for important label batches
6. **Check IP**: Verify printer IP before sending
7. **Monitor stock**: Ensure label paper is loaded

## API Integration

### Direct ZPL Usage
Copy the ZPL output and send directly to printer:

```bash
# Via network (TCP/IP)
echo "[ZPL_CODE]" | nc printer-ip 9100

# Via USB (using driver)
lp -h printer-ip /dev/stdin
```

### Batch Operations
Generate list → Copy all ZPL codes → Send via printer API

---

**Last Updated**: May 2026  
**Version**: 1.0  
**Supports**: Zebra ZebraNet, direct TCP/IP printing
