# VCG Foundation — AI Grant Team

Multi-agent platform for finding grants, drafting proposals, tracking impact outcomes, and identifying fundraising prospects for homeless and at-risk veterans.

## Repo structure (IMPORTANT)

These files must sit at the **root of the repository** — not inside a subfolder:

```
/                     <- repo root
├── netlify.toml      <- must be here, at the root
├── package.json
├── .gitignore
├── public/
│   └── index.html
└── netlify/
    └── functions/
        ├── agent-run.js
        └── agents.js
```

If `netlify.toml` ends up one level down (e.g. `/vcg-grant-team/netlify.toml`), Netlify will not find it and the site shows "Page not found." Upload the **contents** of the project folder, not the folder itself.

## Deploy (GitHub + Netlify continuous deploy)

1. Create a new GitHub repo.
2. Upload the files above so `netlify.toml` is at the repo root.
3. In Netlify: **Add new site → Import an existing project → GitHub →** select the repo.
4. Build settings are read from `netlify.toml` automatically. If prompted:
   - Build command: *(leave empty)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
5. **Site configuration → Environment variables →** add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com (starts with `sk-ant-`, billing enabled)
6. Trigger a deploy (Git deploys auto-build, so this usually happens on its own).
7. Verify: **Site configuration → Functions** should list `agent-run`.

## Test

Open the site → Grant Team tab → run **Grant Scout**. Grant results = everything works.

## The 11 agents

Scout, Eligibility, Research, Impact (KPIs), Proposal, Budget, Compliance, Submission, Reporting, Impact Report Writer (Module 5), Fundraising Prospector (Module 6).

All agents call the Anthropic API server-side via one Netlify Function (`agent-run.js`); the API key never reaches the browser.

## Editing agents

All agent roles and prompts live in `netlify/functions/agents.js` — one file.
