// Content for the public SHROOM × SAI tokenomics explainer.
//
// Source of truth is `shroom_launchpad/docs/SAI_TOKENOMICS_PLAN.md` (revision 2,
// 2026-07-27) and its publishable companion `sai-tokenomics-system.html`. This
// file is the plain-data subset of that plan; the view only renders it.
//
// Everything here is either fixed by design (supply, allocations, fee splits,
// graduation targets) or explicitly labelled a snapshot. Live prices, market
// caps and liquidity deliberately do NOT live here — they drift, and the
// Shroom Hub already shows them from the Choice API. Link there instead.

export const PLAN_REVISION = 'Revision 2';
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
        sai: 105_000,
        pct: 10.5,
        color: '#2dd4bf',
        desc: 'LP farms, quests and airdrops. The creator airdrop only pays when a launch goes live, and unclaimed drops are clawed back.',
        status: 'planned',
    },
    {
        name: 'Launch underwriting',
        sai: 75_000,
        pct: 7.5,
        color: '#14b8a6',
        desc: 'Closes the gap on launches that already found real buyers — the treasury buys on the curve, so it becomes permanent pool liquidity.',
        status: 'planned',
    },
    {
        name: 'Ask ladder',
        sai: 370_000,
        pct: 37.0,
        color: '#0d9488',
        desc: 'On-chain and published, sells only into strength — six ranges from 1.3× to 20× spot. The only path from treasury to circulating.',
        status: 'planned',
    },
    {
        // 40,000 in the plan's allocation table, plus the 80 SAI the treasury
        // holds over the round 690,000 it was written against — so the slices
        // reconcile to max supply exactly.
        name: 'Reserve',
        sai: 40_080,
        pct: 4.0,
        color: '#0f766e',
        desc: 'Held for ladder top-ups and contingency.',
        status: 'planned',
    },
    {
        name: 'Graduation Lock',
        sai: 100_000,
        pct: 10.0,
        color: '#115e59',
        desc: 'Timelocked 24 months. Releases 10,000 SAI per five SAI-quoted graduations, into underwriting only — never sold, never funds operations.',
        status: 'planned',
    },
];

/** SAI is fixed-supply with no mint function; the slices above reconcile to it. */
export const SAI_MAX_SUPPLY = 1_000_000;

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
        body: 'The on-ramp. One hop from stables into SAI, so a pad buyer never has to route through three pools to reach a launch. Opened by the ask ladder, with no capital required.',
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
        figure: '103%',
        unit: 'opening APR · SHROOM/INJ LP',
        body: 'The pair that anchors the whole ecosystem to INJ — every USD price downstream derives from it, so it gets the larger farm. Stake the LP token; rewards accrue per block and nothing is locked.',
        status: 'planned' as Status,
    },
    {
        label: 'Provide liquidity',
        figure: '36%',
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
    {
        label: 'Launch a token',
        figure: '300',
        unit: 'SAI · on your first SAI-quoted launch',
        body: 'If you have ever deployed a token on Injective, there is an allocation with your name on it. It unlocks when your first SAI-quoted launch goes live — paid for launching, not for existing.',
        status: 'planned' as Status,
    },
];

// ---------------------------------------------------------------------------
// Rollout — ordered by relation to the ladder, not by size
// ---------------------------------------------------------------------------

export const ROLLOUT = [
    {
        when: 'Week 0',
        what: 'Ask ladder + Graduation Lock',
        why: 'Opens SAI/USDC with zero capital and publishes what the treasury may do with the rest.',
        status: 'planned' as Status,
    },
    {
        when: 'Week 1',
        what: 'Launch underwriting',
        why: 'Complementary to the ladder — launch demand is what pulls SAI off it.',
        status: 'planned' as Status,
    },
    {
        when: 'Week 3–4',
        what: 'Quests + creator airdrop',
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
