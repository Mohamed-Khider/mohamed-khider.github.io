# Warehouse Label System

A modern Next.js application for generating and printing warehouse barcode labels. Built with TypeScript, React, and Material Design.

## Features

- **Single Barcode Generator**: Create individual barcode labels
- **Multi Barcode Generator**: Generate multiple labels from a list
- **Pallet Labels**: Generate pallet-specific barcode sequences
- **Section Labels**: Create section labels with RML code structure
- **Direct Printer Integration**: Send ZPL directly to Zebra printers via network
- **PDF Export**: Download generated labels as PDF
- **Print Preview**: Browser-based print functionality
- **Warehouse Operations**: Receiving, stock movement, shipments, locations, cycle count, packing, reports, users, and local backup/restore
- **Hardened Local Auth**: Salted password hashing, password policy, session expiry, failed-login lockout, and default-password change enforcement
done
## Production Readiness

This app is ready as a browser-based single-site warehouse tool with local data backup. For secure multi-user production, add a backend database, server-side authentication, audit logs, and server-backed printer integration.

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the exact checklist.

New local installs create a default administrator:

- Username: `admin`
- Password: `Admin@123456`

The app requires this password to be changed before entering protected warehouse pages.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: CSS Modules with Material Design
- **Barcode Generation**: JsBarcode library
- **PDF Generation**: jsPDF + html2canvas
- **Printer Integration**: Server-side ZPL over TCP

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Mohamed-Khider/mohamed-khider.github.io.git
   cd mohamed-khider.github.io
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

5. Validate before deployment:
   ```bash
   npm run validate
   ```

## Deployment to GitHub Pages

This project is configured for automatic deployment to GitHub Pages:

### Prerequisites

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Set Source to "GitHub Actions"

2. **Configure Printer IP** (optional):
   - Set `ZEBRA_PRINTER_IP` in your repository secrets if you want server-side printer configuration
   - Or users can enter printer IP directly in the app

### Automatic Deployment

The app automatically deploys when you push to the `main` branch. The GitHub Actions workflow:

1. Installs dependencies
2. Builds the Next.js app for static export
3. Deploys to GitHub Pages

### Manual Deployment

You can also trigger deployment manually:

1. Go to the Actions tab in your GitHub repository
2. Click "Deploy to GitHub Pages"
3. Click "Run workflow"

## Printer Setup

### Networked Zebra Printers

For direct ZPL printing without Zebra Browser Print:

1. Ensure your Zebra printer is on the same network as your deployment server
2. Configure the printer IP in one of these ways:
   - Set `ZEBRA_PRINTER_IP` environment variable on the server
   - Enter printer IP directly in the app's printer IP field

### Local Development

For local testing, you can use a TCP server to simulate the printer:

```bash
# Install netcat for testing
sudo apt-get install netcat

# Start a test server on port 9100
nc -l -p 9100
```

Then use `127.0.0.1` as the printer IP in the app.

## Project Structure

```
├── app/
│   ├── api/print-zpl/          # Server-side ZPL printing API
│   ├── components/             # Shared React components
│   ├── generate-barcode/       # Single barcode page
│   ├── generate-multi-barcode/ # Multi barcode page
│   ├── lib/                    # Utility functions
│   ├── main/                   # Dashboard page
│   ├── pallet/                 # Pallet labels page
│   ├── section/                # Section labels page
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Login page
├── .github/workflows/          # GitHub Actions
├── public/                     # Static assets
└── package.json                # Dependencies and scripts
```

## Environment Variables

- `ZEBRA_PRINTER_IP`: Default printer IP address (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

This project is private and proprietary.
