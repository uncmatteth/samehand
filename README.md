# Samehand

Living Worlds restyle studio (Grok App Builder export).

## What it does

1. **Bible** — load cast, **normalize** character roots to one series craft  
2. **Pages** — lock episode house look, restyle stills (proof → batch), zip finals  
3. **Ensemble** — group plates from locked characters  

## Run locally

```bash
npm install
# set XAI_API_KEY in the environment for /images/edits
npm run dev
```

App listens on port **8080**.

## Living Worlds

- Cast template + root stills ship under `public/living-worlds/`
- One-click setup loads Mara, Kael, Tamsin, and the rest
- Normalize bible roots **before** restyling episode pages

## Note

This was developed in Grok App Builder. Your Grok preview is separate from this GitHub repo; clone here to run outside Grok.
