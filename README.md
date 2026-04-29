**Fire Alarm Design Assistant**

**About**

This is a Base44-powered Vite/React app for creating fire alarm design projects, analyzing core code requirements, placing devices on uploaded floor plans, generating calculations, and preparing design exports.

Code-analysis output is a design aid only. Always verify requirements with the applicable Authority Having Jurisdiction (AHJ), adopted code editions, manufacturer instructions, and a licensed fire-protection professional.

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
VITE_BASE44_FUNCTIONS_VERSION=optional_functions_version

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

**Architecture**

- `src/pages` contains top-level routes for the project list, setup wizard, designer, and code reference.
- `src/components/designer` contains the canvas designer, panels, reports, and fire alarm drawing tools.
- `src/lib/codeEngine.js` contains code-rule heuristics and placement calculations.
- `src/lib/circuitRouter.js` computes routed circuit paths.
- `src/lib/dxfExport.js` creates CAD-style exports.
- `src/lib/productInfo.js` contains shared product disclaimers and the Bluebeam-inspired feature roadmap.

**Bluebeam-inspired feature map**

See [`docs/bluebeam-revu-feature-map.md`](docs/bluebeam-revu-feature-map.md) for researched Bluebeam Revu functionality and how it maps to this app's future product areas.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
