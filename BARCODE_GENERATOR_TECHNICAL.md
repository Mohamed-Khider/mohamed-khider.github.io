# Barcode Generator - Technical Architecture

## Code Structure

### Core Service: `app/lib/barcodeGenerator.ts`

The single source of truth for all barcode generation logic.

#### Types & Interfaces

```typescript
type LabelSize = "2x1" | "4x6"

interface LabelDimensions {
  width: number        // dots (1/203 inch)
  height: number       // dots
  label: string        // display name
}

interface BarcodeItem {
  code: string        // barcode value
  label: string       // display label
}

interface GenerationOptions {
  labelSize: LabelSize
  startX?: number     // optional positioning
  startY?: number
}
```

#### Key Functions

##### `generateBarcodeRange(spec, prefix, levelSuffix)`
Generates sequential barcodes from range specifications.

**Input:**
- `spec`: "1-5" or "001-010"
- `prefix`: "BIN-S-" (optional)
- `levelSuffix`: "A", "B", etc. (optional)

**Output:** Array of `BarcodeItem[]`

**Examples:**
```js
generateBarcodeRange("1-5", "BIN-S-")
// → [BIN-S-1, BIN-S-2, ..., BIN-S-5]

generateBarcodeRange("001-010", "RML-C01-S01-L")
// → [RML-C01-S01-L001, ..., RML-C01-S01-L010]
```

##### `generateZpl(codes, options)`
Generates complete ZPL code for printing.

**Features:**
- Handles both label sizes
- Automatic page breaks for small labels
- 2×2 grid layout for standard labels
- CODE128 barcode format

**Output:** Complete ZPL string ready for printer

##### `buildLocationBarcode(warehouse, zone, section, level)`
Constructs location barcodes from components.

**Format:** `{warehouse}-{zone}-{section}-{level}`

**Example:**
```js
buildLocationBarcode("RML", "C01", "S01", "L1A")
// → "RML-C01-S01-L1A"
```

### UI Component: `app/labels/page.tsx`

Modern React component implementing the user interface.

#### State Management

```typescript
// Generation inputs
[generationMode, setGenerationMode]         // Mode selector
[labelSize, setLabelSize]                   // Label size
[singleCode, setSingleCode]                 // Single barcode input
[rangeStart/End, setRange...]               // Range inputs
[locationForm, setLocationForm]             // Location form fields

// Generated data
[barcodes, setBarcodes]                     // Array of generated items
[zplOutput, setZplOutput]                   // ZPL code string
[currentPageIndex, setCurrentPageIndex]     // Pagination

// UI state
[notification, setNotification]             // Toast notifications
[isPrinting, setIsPrinting]                 // Print status
[isSending, setIsSending]                   // Sending status
```

#### Render Sections

1. **Configuration Card**
   - Mode selector dropdown
   - Label size selector
   - Printer IP input
   - Permission warning

2. **Input Card** (Dynamic based on mode)
   - Single: Text input
   - Range: Prefix + start/end numbers
   - List: Textarea
   - Location: 6-field form

3. **Preview Card** (Shows after generation)
   - Grid of barcode SVGs
   - Page navigation
   - Action buttons

4. **ZPL Output Card**
   - Dark code block
   - Scrollable content

## Data Flow

```
┌─────────────────────────────────────────┐
│  User Input (Mode-specific form)        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  handleGenerate() validation            │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  barcodeGenerator.ts functions          │
│  - generateBarcodeRange()               │
│  - buildLocationBarcode()               │
│  - generateZpl()                        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  State Update                           │
│  - setBarcodes[]                        │
│  - setZplOutput()                       │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Render Preview                         │
│  - JsBarcode SVG rendering              │
│  - Pagination logic                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Export/Print Options                   │
│  - handlePrint() → window.print()       │
│  - handleSendToZebra() → API call       │
│  - handleCopyZpl() → clipboard          │
│  - handleDownloadPdf() → PDF + print    │
└─────────────────────────────────────────┘
```

## PDF Export Implementation

The `handleDownloadPdf()` function creates properly formatted PDFs:

### Algorithm
```typescript
1. Determine label dimensions in millimeters
   - 2.5×1": 63.5mm × 25.4mm (landscape)
   - 4×6": 101.6mm × 152.4mm (portrait)

2. Calculate pages needed
   - Small labels: 1 per page
   - Large labels: 4 per page (2×2 grid)

3. For each page:
   a. Create grid container (2×2 for large, 1×1 for small)
   b. Render each barcode SVG into grid cell
   c. Add label text below barcode
   d. Convert to canvas (scale: 2x)
   e. Add canvas image to PDF
   f. Add new page if more items remain

4. Save PDF file
5. Open print dialog automatically
```

### Page Layout Examples

**Small Label Page (2.5×1")**
```
┌─────────────────────────┐
│                         │
│   [BARCODE SVG]         │
│   CODE-001              │
│                         │
└─────────────────────────┘
```

**Large Label Page (4×6")**
```
┌─────────────────────┬─────────────────────┐
│  [BARCODE]          │  [BARCODE]          │
│  CODE-001           │  CODE-002           │
├─────────────────────┼─────────────────────┤
│  [BARCODE]          │  [BARCODE]          │
│  CODE-003           │  CODE-004           │
└─────────────────────┴─────────────────────┘
```

### Key Features
- **Proper scaling**: Uses exact label dimensions
- **Grid layout**: Auto-arranges items per page
- **Canvas rendering**: html2canvas for accurate conversion
- **Automatic pagination**: Creates multiple pages as needed
- **Print dialog**: Opens immediately after save

## Label Size Calculations

### 2.5" × 1" Label
- **Width (mm)**: 2.5 × 25.4 = 63.5 mm
- **Height (mm)**: 1 × 25.4 = 25.4 mm
- **Width (dots)**: 2.5 × 203 = 507.5 ≈ 508
- **Height (dots)**: 1 × 203 = 203
- **Barcode height**: 40 pixels (display)
- **Text height**: 9px font (display)
- **Items per page**: 1

### 4" × 6" Label
- **Width (mm)**: 4 × 25.4 = 101.6 mm
- **Height (mm)**: 6 × 25.4 = 152.4 mm
- **Width (dots)**: 4 × 203 = 812
- **Height (dots)**: 6 × 203 = 1218
- **Barcode height**: 60 pixels (display)
- **Text height**: 11px font (display)
- **Items per page**: 4 (2×2 grid)
- **Spacing**: 609 dots per row

## ZPL Generation Details

### Small Label ZPL (2.5×1)
```zpl
^XA                     # Start
^PW508                  # Width
^LL203                  # Length
^FO30,10                # Field origin (barcode position)
^BY2,2,80               # Barcode module config
^BCN,80,N,N,N           # CODE128 barcode
^FD[CODE]^FS            # Field data
^FO30,100               # Text position
^A0N,16,16              # Font
^FD[CODE]^FS
^XZ                     # End
```

### Standard Label ZPL (4×6)
```zpl
^XA
^PW812
^LL1218
^LH0,0                  # Multiple barcodes
^FO[X],[Y]              # Position for each
^BY3,2,100
^BCN,100,N,N,N
^FD[CODE]^FS
...repeat for each barcode...
^XZ
```

## Error Handling

### Validation Layer

```typescript
validateBarcodeCode(code): { valid: boolean; error?: string }
```

**Rules:**
- Min length: 1 character
- Max length: 100 characters
- Allowed: alphanumeric, `-`, `_`, `.`
- Rejects: special characters, spaces

### Permission Checks

```typescript
canPrint = hasPermission(currentUser, "print_labels")
```

Prevents printing if user lacks permission (admin-controlled).

## Performance Considerations

1. **SVG Rendering**: JsBarcode renders barcode SVGs on-demand
2. **Pagination**: Only renders current page's barcodes
3. **ZPL Generation**: Computed once on generation
4. **Canvas Export**: html2canvas runs async for PDF

### Optimization Tips

- For 100+ barcodes: Use pagination
- For bulk ZPL: Copy code instead of rendering SVG
- For PDFs: Export in pages to reduce memory

## Integration Points

### API Dependencies

```typescript
// Print service
sendZplToPrinter(zpl, printerIp)
// → POST /api/print-zpl

// User management
getCurrentUser()
hasPermission(user, "print_labels")

// Components
<ProtectedPage requireAdmin={true}>
<NotificationModal>
<PageHeader>
```

### External Libraries

- **jsbarcode**: `^3.11.6` - SVG barcode rendering
- **html2canvas**: `^1.4.1` - Canvas export
- **jspdf**: `^2.5.1` - PDF generation
- **next**: `^14.2.5` - React framework

## Testing Recommendations

### Unit Tests
- `barcodeGenerator.ts` functions
  - Range generation with edge cases
  - Location barcode building
  - ZPL output format validation

### Integration Tests
- Form submissions
- ZPL generation for each mode
- Export functionality

### E2E Tests
- Full workflow for each mode
- Printer communication
- PDF/clipboard operations

## Future Enhancements

1. **Barcode Types**: Add UPC-A, EAN-13, QR codes
2. **Label Templates**: Custom layout designs
3. **Batch Scheduling**: Schedule printing for later
4. **Print History**: Track all printed batches
5. **Barcode Library**: Save favorite formats
6. **Multi-Printer**: Queue to multiple printers
7. **Preview Images**: Live Zebra simulation

---

**Last Updated**: May 2026  
**Maintainer**: System Admin  
**Status**: Production Ready
