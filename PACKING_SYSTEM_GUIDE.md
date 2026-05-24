# B2B Order Packing System - User Guide

## Overview

The B2B Order Packing System is designed to streamline the process of packing mixed-item orders into boxes, tracking contents, and generating comprehensive packing lists for warehouse operations.

## System Features

### 1. **Box Identification**
- **Generated ID Mode**: Auto-generates professional box IDs using client name + serial number (e.g., "LB-001", "LB-002")
- **Box Number Mode**: Simple sequential numbering (e.g., "Box 1", "Box 2", "Box 3")

### 2. **Item Management**
Supports two packing types:
- **pack_unit**: Individual items that need to be placed into boxes
- **pack_l1**: Complete boxes (already packaged units)

### 3. **Packing Process**
- Create new order with client details
- Add items manually or import from CSV file
- Scan/enter items as they're packed into each box
- System warns if quantity exceeds order amount
- Complete box and move to next one
- Full quantity validation before finishing

### 4. **Export & Documentation**
- Generate PDF packing lists with box details
- Export to Excel (CSV format)
- All packing records saved for future reference
- Edit or correct records anytime

### 5. **Progress Tracking**
- Real-time packing progress bar (percentage)
- Box count and item quantity tracking
- Item-by-item completion status

---

## Workflow Step-by-Step

### Step 1: Create New Packing Order
1. Navigate to **Packing** → **New Packing Order**
2. Enter **Order ID** (e.g., "ORD-2024-001")
3. Enter **Client Name** (e.g., "ABC Company")
4. Choose **Box Identification Type**:
   - Generated ID: Uses first 2 letters of client name
   - Box Number: Simple numbering
5. Optionally enable **Track Item Numbers** (warns on qty overages)

### Step 2: Add Items to Packing List

#### Option A: Import from CSV File
1. Prepare a CSV file with format:
   ```
   SKU,Name,PackType,Quantity,UOM
   SKU-001,Product Name,pack_unit,10,PCS
   SKU-002,Box Product,pack_l1,5,BOX
   ```
2. Click **Upload Packing List**
3. Select your CSV file
4. System automatically parses all items

#### Option B: Add Items Manually
1. Fill in the quick-add form:
   - **SKU**: Product identifier
   - **Name**: Product name
   - **Pack Type**: Select `pack_unit` or `pack_l1`
   - **Quantity**: Total amount to pack
2. Click **Add Item**
3. Repeat for all items

### Step 3: Start Packing
1. Review the items list
2. Click **Start Packing →**
3. System initializes first box

### Step 4: Pack Items into Boxes
1. **Select Item** from dropdown (shows remaining qty)
2. **Enter Quantity** to add to current box
3. Click **Add to Box**
4. Item appears in current box contents
5. Repeat until box is full
6. Click **Complete Box & New Box** to start new box
7. Continue for all boxes

**Available Actions:**
- **Undo**: Remove last item added to box
- **Complete Box**: Finish current box, create new one
- **Finish Packing**: Only available when all items are packed

### Step 5: Complete & Export
1. System validates all items are packed
2. Click **Finish Packing** when complete
3. Packing record is automatically saved
4. Choose export format:
   - **PDF**: Professional packing list document
   - **Excel (CSV)**: Spreadsheet with all details

---

## CSV File Format

### Example Packing List (CSV)
```csv
SKU,Name,PackType,Quantity,UOM
PROD-001,Widget A,pack_unit,50,PCS
PROD-002,Gadget B,pack_unit,25,PCS
PROD-003,Box Set C,pack_l1,10,BOX
PROD-004,Display Item,pack_unit,100,PCS
```

### CSV Parsing Rules
- First row is treated as header (skipped)
- Supports both comma and tab-separated values
- Minimum 5 columns required: SKU, Name, PackType, Quantity, UOM
- PackType: Use "pack_unit" or "pack_l1"
- Quantity must be a positive number
- Invalid rows are skipped

---

## Packing History & Records

### Viewing Past Orders
1. Navigate to **Packing** → **Packing History**
2. Select an order from the list
3. View summary statistics (boxes, items, types)
4. Export again as PDF or Excel if needed
5. Delete record if no longer needed

### Record Information Stored
- Order ID & Client Name
- Box details with contents
- Item quantities and types
- Timestamps for each action
- Packing status

---

## Box ID Generation Logic

### Generated ID Format
1. Take first 2 letters of client name (uppercase)
2. Remove non-alphabetic characters if needed
3. Add serial number (auto-incrementing, padded with zeros)
4. Result: "XX-###" (e.g., "LB-001", "LB-002")

### Examples
| Client Name | Box 1 | Box 2 | Box 3 |
|------------|-------|-------|-------|
| ABC Company | ABC-001 | ABC-002 | ABC-003 |
| L&M Supplies | LM-001 | LM-002 | LM-003 |
| XYZ Distribution | XY-001 | XY-002 | XY-003 |

---

## PDF Export Contents

The exported PDF includes:
- **Header**: Order ID, Client Name, Creation Date
- **Summary**: Total boxes, items to pack
- **Box Details**: For each box:
  - Box ID
  - Item list with SKU, quantity, type
  - Required vs packed quantities
- **Footer**: Export timestamp, packing status

---

## Best Practices

### ✅ Do's
- Use descriptive SKUs for easy scanning
- Add complete product names for clarity
- Include UOM (PCS, BOX, SET, etc.) for consistency
- Verify quantities match order before starting
- Save/export packing records regularly
- Use generated IDs for professional labeling

### ❌ Don'ts
- Don't start packing without all items defined
- Don't skip quantity validation warnings
- Don't lose your CSV template - reuse for similar orders
- Don't forget to complete boxes before finishing packing

---

## Troubleshooting

### Q: CSV file not parsing?
**A**: Check format:
- Must have header row (SKU, Name, PackType, Quantity, UOM)
- No special characters in SKU or quantity fields
- Quantity must be a number greater than 0

### Q: Qty warning when adding items?
**A**: System is warning that quantity exceeds order. Either:
- Reduce the qty you're adding
- Check if order qty is correct

### Q: How to edit a completed order?
**A**: Navigate to **Packing History**, select order, delete it, then create a new one.

### Q: Export not working?
**A**: Ensure:
- Packing is fully completed (all items packed)
- Browser allows file downloads
- Pop-ups aren't blocked

---

## Integration Notes

- **Client-Side Storage**: All records stored in browser localStorage
- **Data Persistence**: Records persist until manually deleted
- **No Server Required**: Works completely offline after initial load
- **Session Management**: Current packing order stored in sessionStorage during active packing

---

## Future Enhancements

Planned features:
- Barcode scanning integration
- Cloud backup of packing records
- Multi-user support with permissions
- Advanced analytics & reporting
- Mobile app for warehouse floor
- Integration with existing inventory system
