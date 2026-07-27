// Content for the public SHROOM × SAI tokenomics explainer.
//
// Source of truth is `shroom_launchpad/docs/SAI_TOKENOMICS_PLAN.md` (revision 3,
// 2026-07-27) and its publishable companion `sai-tokenomics-system.html`. This
// file is the plain-data subset of that plan; the view only renders it.
//
// Everything here is either fixed by design (supply, allocations, fee splits,
// graduation targets) or explicitly labelled a snapshot. Live prices, market
// caps and liquidity deliberately do NOT live here — they drift, and the
// Shroom Hub already shows them from the Choice API. Link there instead.
//
// Revision 3 has four components — ladder, airdrops, quests, farms. The
// Graduation Lock and launch underwriting that revision 2 introduced are both
// gone (reasoning lives in the plan doc, not on this page).

export const PLAN_REVISION = 'Revision 3';
export const PLAN_DATE = '27 July 2026';

/** Whether a component of the plan is deployed today. */
export type Status = 'live' | 'planned';

export const THESIS = 'SAI is retired by use. SHROOM is retired by revenue.';

// ---------------------------------------------------------------------------
// The two tokens
// ---------------------------------------------------------------------------

export interface TokenCard {
    symbol: string;
    name: string;
    role: string;
    color: string;
    body: readonly string[];
    facts: readonly { label: string; value: string }[];
}

export const TOKENS: readonly TokenCard[] = [
    {
        symbol: 'SAI',
        name: 'ShroomAI',
        role: 'The working asset',
        color: '#10b981',
        body: [
            'The quote currency on SHROOM Pad. Launch a token against SAI and buyers price it in SAI, trade it in SAI and pay fees in SAI.',
            'Demand for SAI is transactional — it comes from people using the pad, not from people speculating on SAI itself. Ideally SAI is boring: a volatile quote asset makes every token launched against it unusable.',
        ],
        facts: [
            { label: 'Max supply', value: '1,000,000' },
            { label: 'Mint function', value: 'none' },
            { label: 'Sink', value: 'locked into every launch' },
            { label: 'Role', value: 'fuel · unit of account' },
        ],
    },
    {
        symbol: 'SHROOM',
        name: 'shroomin',
        role: 'The claim on activity',
        color: '#f59e0b',
        body: [
            'Effectively fully circulating, with no treasury left and no emission story to tell. Nothing new is ever minted and nothing is held back.',
            'SHROOM’s only mechanism is deflation: fees buy SHROOM on the open market and burn it. The more the pad is used, the less SHROOM exists.',
        ],
        facts: [
            { label: 'Total supply', value: '1,000,000,000' },
            { label: 'Circulating', value: '96.9%' },
            { label: 'Already burned', value: '31,401,400' },
            { label: 'Sink', value: 'fee-funded buy & burn' },
        ],
    },
];

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export interface LoopStep {
    step: string;
    title: string;
    detail: string;
    status: Status;
}

export const LOOP: readonly LoopStep[] = [
    {
        step: 'Launch',
        title: 'A token is launched, priced in SAI',
        detail: 'The creator keeps 0.9% of every trade on the curve — the most generous split of the three quote assets.',
        status: 'live',
    },
    {
        step: 'SAI sink',
        title: 'SAI is locked into the pool',
        detail: '10,000 SAI per graduating launch — 3.2% of circulating supply — goes into a permanent CLMM pool and never comes back out.',
        status: 'live',
    },
    {
        step: 'Fees',
        title: 'Every trade pays a fee',
        detail: 'Collected in the quote asset. INJ- and USDC-quoted launches pay 0.9% to the platform; that is the revenue line.',
        status: 'live',
    },
    {
        step: 'SHROOM sink',
        title: 'Fees buy SHROOM, and burn it',
        detail: 'INJ/USDC pad fees and ladder proceeds are spent buying SHROOM on the open market and burning it. Supply falls, permanently.',
        status: 'planned',
    },
];

export const SINKS = [
    {
        label: 'SAI sink',
        headline: '10,000 SAI',
        body: 'Locked into the pool by every graduating SAI-quoted launch — 3.2% of circulating supply, per launch. It never comes back out.',
        status: 'live' as Status,
    },
    {
        label: 'SHROOM sink',
        headline: 'Every fee, forever',
        body: 'Fees are spent buying SHROOM on the open market and burning it. 31.4M is already gone, and there is no mint function.',
        status: 'planned' as Status,
    },
];

// ---------------------------------------------------------------------------
// SAI supply — ordered by availability, brightest is liquid today
// ---------------------------------------------------------------------------

export interface SupplySlice {
    name: string;
    sai: number;
    pct: number;
    color: string;
    desc: string;
    status: Status;
}

export const SUPPLY: readonly SupplySlice[] = [
    {
        name: 'Circulating',
        sai: 309_920,
        pct: 31.0,
        color: '#5eead4',
        desc: 'Held by the market today.',
        status: 'live',
    },
    {
        name: 'Rewards',
        sai: 110_000,
        pct: 11.0,
        color: '#2dd4bf',
        desc: 'LP farms, terminal quests and the airdrop — farms are the largest, because depth is the thing the ecosystem is actually short of. Anything unclaimed from the airdrop is clawed back.',
        status: 'planned',
    },
    {
        name: 'Ask ladder',
        sai: 500_000,
        pct: 50.0,
        color: '#0d9488',
        desc: 'On-chain and published, sells only into strength — eight ranges from 1.3× to 45× spot. The only path from treasury to circulating.',
        status: 'planned',
    },
    {
        // 80,000 in the plan's allocation table, plus the 80 SAI the treasury
        // holds over the round 690,000 it was written against — so the slices
        // reconcile to max supply exactly.
        name: 'Operating reserve',
        sai: 80_080,
        pct: 8.0,
        color: '#0f766e',
        desc: 'About 45,000 is the SAI side of the permanent SAI/USDC pool the ladder pays for. The rest is contingency, stated as such rather than assigned to a mechanism.',
        status: 'planned',
    },
];

/** SAI is fixed-supply with no mint function; the slices above reconcile to it. */
export const SAI_MAX_SUPPLY = 1_000_000;

// ---------------------------------------------------------------------------
// The published ladder
//
// The entire value of the ladder over a plain treasury is that it is legible:
// an unpublished ladder is an opaque treasury with extra steps. So the bands
// are published here, in full, before they are placed.
//
// Prices are multiples of spot AT PLACEMENT, quoted here against the reference
// spot below. They are fixed once the positions are minted.
// ---------------------------------------------------------------------------

export const LADDER_REFERENCE_SPOT = 0.0522729;
export const LADDER_TOTAL = 500_000;

export interface LadderBand {
    band: number;
    /** Multiple-of-spot label, e.g. "1.3× – 1.8×". */
    range: string;
    /** USD price range at the reference spot. */
    price: string;
    sai: number;
    pct: number;
    /**
     * Bands 1-3 exist to bank USDC — the proceeds are withdrawn and become
     * depth. Bands 4-8 are overhang disclosure and are allowed to sit.
     */
    reserve: boolean;
}

export const LADDER: readonly LadderBand[] = [
    { band: 1, range: '1.3× – 1.8×', price: '$0.0680 – $0.0941', sai: 20_000, pct: 4, reserve: true },
    { band: 2, range: '1.8× – 2.6×', price: '$0.0941 – $0.1359', sai: 30_000, pct: 6, reserve: true },
    { band: 3, range: '2.6× – 4×', price: '$0.1359 – $0.2091', sai: 50_000, pct: 10, reserve: true },
    { band: 4, range: '4× – 7×', price: '$0.2091 – $0.3659', sai: 70_000, pct: 14, reserve: false },
    { band: 5, range: '7× – 12×', price: '$0.3659 – $0.6273', sai: 90_000, pct: 18, reserve: false },
    { band: 6, range: '12× – 20×', price: '$0.6273 – $1.0455', sai: 110_000, pct: 22, reserve: false },
    { band: 7, range: '20× – 30×', price: '$1.0455 – $1.5682', sai: 60_000, pct: 12, reserve: false },
    { band: 8, range: '30× – 45×', price: '$1.5682 – $2.3523', sai: 70_000, pct: 14, reserve: false },
];

// ---------------------------------------------------------------------------
// Quote assets
// ---------------------------------------------------------------------------

export const QUOTES = [
    {
        symbol: 'SAI',
        purpose: 'Growth — cheap to launch, generous to creators. Drives the SAI sink.',
        creator: '0.9%',
        platform: '0.1%',
        graduates: '10,000 SAI',
        highlight: true,
    },
    {
        symbol: 'INJ',
        purpose: 'Revenue — funds the SHROOM buy & burn.',
        creator: '0.1%',
        platform: '0.9%',
        graduates: '2,500 INJ',
        highlight: false,
    },
    {
        symbol: 'USDC',
        purpose: 'Revenue — funds the SHROOM buy & burn.',
        creator: '0.1%',
        platform: '0.9%',
        graduates: '10,950 USDC',
        highlight: false,
    },
] as const;

export const RAILS = [
    {
        pair: 'SAI / USDC',
        body: 'The on-ramp. One hop from stables into SAI, so a pad buyer never has to route through three pools to reach a launch. Opened by the ask ladder with no capital required — and once the first bands sell out, their proceeds seed a permanent full-range pool so SAI has stable liquidity at every price, not just today’s.',
        status: 'planned' as Status,
    },
    {
        pair: 'SAI / SHROOM',
        body: 'The conversion rail. This is where fees become SHROOM buybacks — the plumbing that connects the fuel to the store of value.',
        status: 'live' as Status,
    },
];

// ---------------------------------------------------------------------------
// Ways to earn SAI
// ---------------------------------------------------------------------------

export const EARN = [
    {
        label: 'Provide liquidity',
        figure: '166%',
        unit: 'opening APR · SHROOM/INJ LP',
        body: 'The pair that anchors the whole ecosystem to INJ — every USD price downstream derives from it, so it gets the larger farm. Stake the LP token; rewards accrue per block and nothing is locked.',
        status: 'planned' as Status,
    },
    {
        label: 'Provide liquidity',
        figure: '46%',
        unit: 'opening APR · SAI/SHROOM LP',
        body: 'The conversion rail that turns pad fees into SHROOM buybacks. Same farm mechanics, same six-month decaying schedule.',
        status: 'planned' as Status,
    },
    {
        label: 'Trade & complete quests',
        figure: 'Weekly',
        unit: 'capped per wallet',
        body: 'Trade through Trippy Terminal, keep a streak going, hold an LP position for a multiplier. Rewards accumulate and grow the longer they sit unclaimed.',
        status: 'planned' as Status,
    },
];

// ---------------------------------------------------------------------------
// Rollout — ordered by relation to the ladder, not by size
// ---------------------------------------------------------------------------

export const ROLLOUT = [
    {
        when: 'Week 0',
        what: 'Ask ladder placed, bands published',
        why: 'Opens SAI/USDC with zero capital, and puts every treasury SAI outside the reserve on the book at a published price.',
        status: 'planned' as Status,
    },
    {
        when: 'Week 0–1',
        what: 'Airdrop claims open',
        why: 'The only component that reaches anyone not already here, so it lands while the announcement is still being read — and before any farm emission exists.',
        status: 'planned' as Status,
    },
    {
        when: 'Week 3–4',
        what: 'Terminal quests',
        why: 'Neutral to the ladder, and the cheapest per-wallet activity lever available.',
        status: 'planned' as Status,
    },
    {
        when: 'Last',
        what: 'LP farms',
        why: 'Deliberately last. Emissions are the one component that pushes price below the band the reserve needs.',
        status: 'planned' as Status,
    },
];
