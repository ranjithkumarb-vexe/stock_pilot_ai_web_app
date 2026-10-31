/* StockPilot AI – illustrative mock records. Not real market data. */
window.SPDATA = (function () {
  const mk = (t, n, s, px, ch, cik, pe, dy, mc, beta, m, x) => ({ t, n, s, px, ch, cik, pe, dy, mc, beta, m, x });
  // m: [revenue $B, growth %, op margin %, FCF $B|null, debt/equity]; x: [trend, bal, val, moat, risk, cat, bull, bear]
  const list = [
    mk('NVDA','NVIDIA Corp.','Technology',182.40,2.14,'1045810',41.2,0.0,4440,1.72,[130.5,114,62.4,60.7,0.12],[
      'Data center revenue drove most of the fiscal-year growth. Revenue grew 114% to $130.5B while operating margin stayed above 60%.',
      'Cash and securities exceed total debt. There is no meaningful dividend; buybacks are the main capital return.',
      'Shares trade at 41x trailing earnings, above the 5-year median of 36x. The price assumes AI infrastructure spending continues.',
      'CUDA software and networking create switching costs around the GPU. Customers build on the full stack, not the chip alone.',
      'A few hyperscale customers account for a large share of revenue. Export controls on advanced chips can restrict sales to China.',
      'The next-generation platform ramp and Q3 earnings on Nov 19. Sovereign AI contracts are listed as a growth driver.',
      'Accelerator demand outpaces supply and software lock-in persists.',
      'Customer capex slows or custom chips take share, compressing a high multiple.']),
    mk('AMD','Advanced Micro Devices','Technology',164.20,-1.32,'2488',98.0,0.0,266,1.90,[25.8,14,7.4,3.5,0.05],[
      'Data center sales grew while PC and gaming recovered slowly. Revenue rose 14% to $25.8B with operating margin near 7%.',
      'Debt is small relative to cash. No dividend is paid.',
      'The trailing P/E of 98x reflects depressed GAAP margins from acquisition amortization. Forward multiples are far lower.',
      'x86 server share and a growing GPU roadmap give AMD two engines. Software tooling still trails the market leader.',
      'Accelerator share depends on a few cloud customers. Wafer supply is concentrated at a single foundry.',
      'Rack-scale accelerator launch and a multi-year supply agreement filed on an 8-K this week.',
      'Server CPU share gains continue and accelerators reach meaningful scale.',
      'Software ecosystem gaps limit adoption and margins stay thin.']),
    mk('TSLA','Tesla Inc.','Consumer Discretionary',342.10,3.05,'1318605',168.0,0.0,1100,2.30,[97.7,1,7.2,3.6,0.17],[
      'Vehicle deliveries were flat and revenue grew 1% to $97.7B. Energy storage was the fastest growing segment.',
      'Cash exceeds debt. No dividend is paid.',
      'The 168x trailing P/E reflects expectations for autonomy and robotics rather than current automotive earnings.',
      'Manufacturing scale, a charging network and software updates differentiate the vehicles. Price cuts have narrowed automotive margins.',
      'Regulatory scrutiny of driver-assistance features is disclosed. Key-person dependence on the CEO is listed as a risk.',
      'Q3 deliveries and a robotaxi expansion update. Energy storage backlog is the nearest reportable catalyst.',
      'Autonomy and energy storage open new high-margin revenue lines.',
      'Automotive margins keep falling and autonomy timelines slip.']),
    mk('META','Meta Platforms','Communication',718.50,0.62,'1326801',27.1,0.3,1810,1.25,[164.5,22,42.0,54.1,0.27],[
      'Advertising revenue grew on impressions and pricing. Revenue rose 22% to $164.5B at a 42% operating margin.',
      'Cash and securities exceed debt. A small quarterly dividend started in 2024.',
      'A 27x trailing P/E sits near the 5-year median. Capex guidance is the main swing factor in free cash flow.',
      'Three billion daily users across its apps give advertisers reach that few platforms match.',
      'Capital spending on AI infrastructure is rising sharply. Youth-safety regulation in the US and EU is an active risk.',
      'Q3 results are scheduled after the close today. Capex guidance for next year is the figure to watch.',
      'AI-driven ad ranking lifts conversion and engagement.',
      'Capex outruns revenue and regulators restrict ad targeting.']),
    mk('AMZN','Amazon.com','Consumer Discretionary',228.90,0.88,'1018724',36.0,0.0,2430,1.30,[638,11,11.0,38.2,0.52],[
      'Cloud and advertising grew faster than retail. Revenue rose 11% to $638B and operating margin reached 11%.',
      'Debt is moderate against large operating cash flow. No dividend is paid.',
      'A 36x P/E reflects the higher margin mix from cloud and advertising.',
      'Logistics scale and a large cloud platform reinforce each other. Prime membership supports retail retention.',
      'Cloud growth depends on AI capacity coming online. Labor and regulatory costs in retail are disclosed.',
      'Q3 cloud growth rate and holiday guidance.',
      'Cloud reaccelerates and retail margins keep rising.',
      'Capex weighs on free cash flow and retail demand softens.']),
    mk('AVGO','Broadcom Inc.','Technology',352.30,1.40,'1730168',38.0,0.7,1660,1.20,[51.6,44,36.0,19.4,1.0],[
      'AI networking and the VMware software segment lifted growth. Revenue rose 44% to $51.6B.',
      'Debt rose with the VMware acquisition and is being repaid from free cash flow. The dividend has grown each year.',
      'A 38x P/E is above semiconductor peers because software now contributes a large share of operating profit.',
      'Custom accelerators and networking chips are designed into customers\' systems for several years at a time.',
      'Customer concentration in custom silicon is high. Integration of VMware licensing changes has drawn customer pushback.',
      'AI revenue guidance at the Q4 report in December.',
      'Custom silicon wins expand and software margins hold.',
      'A top customer shifts designs in-house.']),
    mk('GOOGL','Alphabet Inc.','Communication',281.40,-0.35,'1652044',24.0,0.4,3400,1.05,[350,14,32.0,73.0,0.1],[
      'Search and cloud both grew double digits. Revenue rose 14% to $350B at a 32% operating margin.',
      'Net cash position with a dividend and ongoing buybacks.',
      'A 24x P/E is below other large platforms. Investors weigh AI search risk against cloud momentum.',
      'Search distribution, YouTube and Android reach billions of users. Data from these products improves the models.',
      'Antitrust remedies could change default search agreements. AI answers may change search advertising economics.',
      'Remedies ruling follow-up and Q3 cloud growth.',
      'Cloud and AI products add growth beyond search.',
      'Regulation forces changes in search distribution.']),
    mk('AAPL','Apple Inc.','Technology',268.70,0.41,'320193',33.0,0.4,3980,1.10,[391,2,31.0,108.0,1.9],[
      'Services growth offset flat hardware sales. Revenue rose 2% to $391B.',
      'Debt exceeds cash on paper but free cash flow funds a dividend and large buybacks.',
      'A 33x P/E is above its 10-year median. Valuation relies on steady services growth.',
      'An installed base of more than two billion active devices anchors services revenue. Switching costs come from the ecosystem.',
      'A large share of manufacturing is in a few countries. App Store fee rules are under regulatory review.',
      'Holiday-quarter guidance and the status of App Store rule changes.',
      'Services mix lifts margins as the installed base grows.',
      'Regulation reduces services fees and hardware demand stays flat.']),
    mk('MSFT','Microsoft Corp.','Technology',521.60,0.27,'789019',35.0,0.7,3880,0.90,[245,16,45.0,71.0,0.33],[
      'Cloud and AI services led growth. Revenue rose 16% to $245B at a 45% operating margin.',
      'Cash exceeds debt and the dividend has risen every year for over a decade.',
      'A 35x P/E is above the 5-year median. The multiple reflects recurring software revenue.',
      'Enterprise software is embedded in daily workflows and renewed on multi-year contracts.',
      'AI capacity spending is large and returns are not yet separately disclosed. Cloud outages and security incidents are listed risks.',
      'Q2 cloud growth and AI capacity commentary in late January.',
      'AI features raise revenue per enterprise seat.',
      'Capex outpaces AI revenue and cloud growth slows.']),
    mk('JNJ','Johnson & Johnson','Healthcare',171.80,-0.22,'200406',17.0,3.1,413,0.50,[88.8,4,26.0,19.0,0.50],[
      'Pharmaceutical growth offset slower medical devices. Revenue rose 4% to $88.8B.',
      'The balance sheet carries a top-tier credit rating. The dividend has increased for more than 60 consecutive years.',
      'A 17x P/E is below the 10-year median, with a 3.1% dividend yield.',
      'A diversified pipeline and medical device installed base spread risk across many products.',
      'Talc litigation reserves remain a disclosed uncertainty. Several key drugs face patent expiry in the next five years.',
      'Phase 3 readouts later this year and the next dividend declaration.',
      'Pipeline launches replace expiring drugs and the dividend keeps growing.',
      'Litigation costs rise and patent expiries outpace launches.']),
    mk('KO','Coca-Cola Co.','Consumer Staples',69.40,0.15,'21344',24.0,2.9,299,0.55,[47.1,3,29.0,5.9,1.6],[
      'Pricing offset flat volumes in most regions. Revenue rose 3% to $47.1B.',
      'Debt is higher than the sector median but covered by stable cash flow. The dividend has risen for 60+ years.',
      'A 24x P/E is above the staples average and the yield is 2.9%.',
      'Brand recognition and a bottler network give pricing power in nearly every market.',
      'Currency swings reduce reported results. Shifts away from sugary drinks and sugar-tax rules are disclosed.',
      '8-K Item 2.02 results filed today. Management\'s full-year outlook is the item to review.',
      'Pricing power and emerging-market volume support steady growth.',
      'Health trends cut volumes and currency moves reduce earnings.']),
    mk('PG','Procter & Gamble','Consumer Staples',156.30,-0.48,'80424',23.0,2.6,366,0.40,[84.3,0,24.0,14.6,0.60],[
      'Organic sales grew on price while volumes were flat. Reported revenue was unchanged at $84.3B.',
      'Leverage is low for the sector. The dividend has increased for 65+ years.',
      'A 23x P/E sits near its 5-year median.',
      'Leading brands in many household categories hold shelf space and pricing.',
      'Commodity and freight costs are disclosed risks. Retailer private labels pressure share in some categories.',
      'Q1 results on Oct 31.',
      'Productivity savings lift margins and the dividend grows.',
      'Volume declines persist and private labels gain share.']),
    mk('PEP','PepsiCo Inc.','Consumer Staples',148.60,0.72,'77476',21.0,3.8,204,0.50,[91.9,0,14.0,7.1,2.3],[
      'Snack volumes softened while beverage pricing held. Revenue was flat at $91.9B.',
      'Debt is above the sector median. The dividend has risen for 50+ years.',
      'A 21x P/E is below the 5-year median with a 3.8% yield.',
      'Snack and beverage brands share distribution, which lowers delivery costs.',
      'Volume declines in North America snacks are disclosed. Activist pressure on portfolio structure is noted.',
      'Cost-savings program updates at the next earnings report.',
      'Cost cuts restore margins and volumes recover.',
      'Consumers keep trading down and leverage limits flexibility.']),
    mk('VZ','Verizon Communications','Communication',41.90,-4.10,'732712',9.5,6.5,177,0.35,[134.8,2,23.0,19.8,1.5],[
      'Wireless subscriber additions slowed and revenue rose 2% to $134.8B.',
      'Debt is high and a large part of free cash flow goes to interest and the dividend.',
      'A 9.5x P/E and 6.5% yield reflect low growth expectations and debt.',
      'Spectrum holdings and a large subscriber base are hard to replicate.',
      'Heavy competition for subscribers is disclosed. Legacy lead-sheathed cable remediation costs are a stated uncertainty.',
      'Dividend coverage review after the share-price decline on the Q3 print.',
      'Subscriber trends stabilize and debt falls.',
      'Price competition continues and free cash flow does not cover the dividend.']),
    mk('XOM','Exxon Mobil','Energy',114.20,0.35,'34088',14.0,3.6,482,0.70,[349,-2,10.0,30.0,0.12],[
      'Lower realized prices reduced revenue by 2% to $349B. Production in Guyana and the Permian rose.',
      'Debt is low and the dividend has risen for over 40 years.',
      'A 14x P/E is near the 10-year median.',
      'Low-cost resource positions and integrated refining reduce exposure to price swings.',
      'Earnings depend on commodity prices. Climate regulation and demand shifts are disclosed.',
      'Quarterly dividend declaration filed on an 8-K this week.',
      'Low-cost barrels sustain cash flow at lower oil prices.',
      'Oil prices fall and demand shifts faster than expected.']),
    mk('JPM','JPMorgan Chase','Financials',301.50,0.19,'19617',14.0,2.0,830,1.05,[177.6,5,38.0,null,null],[
      'Net interest income and markets revenue rose. Net revenue grew 5% to $177.6B.',
      'Capital ratios are above regulatory minimums. Free cash flow is not a meaningful measure for banks.',
      'A 14x P/E is above its 10-year median. Tangible book value is the usual anchor for banks.',
      'Scale in consumer, commercial and investment banking spreads funding and technology costs.',
      'Credit losses rise in a downturn. Capital rule changes could affect buybacks.',
      'Q3 results and the stress test capital buffer announcement.',
      'Credit stays benign and capital returns increase.',
      'Credit losses rise and net interest income falls with rates.'])
  ];
  const U = {}; list.forEach(u => (U[u.t] = u));

  const SECS = [
    ['trend', 'Trend & growth', 'Item 7 · MD&A', 0], ['bal', 'Balance sheet & dividend', 'XBRL + Item 7', 1],
    ['val', 'Valuation context', 'XBRL ratio (code)', 2], ['moat', 'Moat', 'Item 1 · Business', 3],
    ['risk', 'Risks', 'Item 1A · Risk Factors', 4], ['cat', 'Catalysts', 'Item 7 + 8-K', 5]
  ];
  const PLAIN = {
    trend: 'In plain terms: this shows whether the company is selling more each year and keeping more of each sale as profit.',
    bal: 'In plain terms: debt is money owed. A company with low debt and steady cash is less likely to cut its dividend.',
    val: 'In plain terms: P/E is the share price divided by yearly profit per share. A higher number means you pay more for each dollar earned.',
    moat: 'In plain terms: a moat is something that makes it hard for rivals to take customers away.',
    risk: 'In plain terms: these are problems the company itself told regulators could hurt results.',
    cat: 'In plain terms: catalysts are dated events, such as earnings reports, that can move the share price.',
    bb: 'In plain terms: the bull case is what must go right. The bear case is what could go wrong.'
  };

  const PERSONAS = {
    priya: {
      id: 'priya', name: 'Priya Nair', init: 'PN', tag: 'Conservative income · 10-year horizon',
      prof: { tier: 2, horizon: '10+ years', goals: ['Income', 'Preservation'], exp: 'Beginner', jargon: 1, depth: 'standard', excl: ['Tobacco'], tone: 'Plain language', metric: 'Dividend yield', lang: 'English', region: 'US · USD' },
      order: ['bal', 'risk', 'moat', 'val', 'trend', 'cat', 'bb'],
      cash: 22014, rules: { pos: 10, sec: 25, dd: 10, trades: 3, cash: 10 },
      hold: [['JNJ', 62, 152.4], ['KO', 130, 61.8], ['PG', 60, 149.1], ['VZ', 215, 39.6], ['PEP', 55, 151.2], ['JPM', 28, 248.3], ['MSFT', 17, 468.0], ['XOM', 70, 108.9], ['AAPL', 24, 231.5]],
      watch: ['JNJ', 'KO', 'PG', 'VZ', 'PEP', 'JPM', 'MSFT', 'XOM', 'AAPL', 'GOOGL'],
      interest: [['Consumer Staples', .82], ['Healthcare', .70], ['Dividend', .90], ['Quality', .74], ['Financials', .50], ['Value', .45], ['Technology', .25], ['Growth', .20]],
      arms: { breach: [2, 1], proposal: [3, 2], filing: [4, 2], move: [1, 4], earnings: [3, 2], mirror: [2, 2], brief: [3, 2] },
      stats: { ytd: 6.8, spy: 11.9, vol: 11.4, beta: 0.62, dd: 3.1, maxdd: 5.8, turnover: 12, win: 67, real: 412, revT: 2.2, pgr: 0.02, seed: 3, amp: 0.012 },
      orders: [[3, 'KO', 'buy', 20, 69.1], [18, 'VZ', 'buy', 40, 41.2], [31, 'PG', 'buy', 10, 154.0], [44, 'JNJ', 'buy', 12, 168.3], [58, 'XOM', 'buy', 20, 112.4], [73, 'JPM', 'sell', 8, 296.0]],
      proposals: [
        { id: 'P-2041', kind: 'trade', tk: 'JNJ', side: 'sell', rule: 'pos', title: 'Position above your 10% cap', age: '2h ago' },
        { id: 'P-2042', kind: 'trade', tk: 'PEP', side: 'sell', rule: 'sec', title: 'Consumer Staples above your 25% sector rule', age: '2h ago' },
        { id: 'P-2043', kind: 'review', tk: 'VZ', title: 'Review dividend coverage after the 4.1% price drop', body: 'Verizon fell 4.1% after its Q3 report. You hold 215 shares and rely on its 6.5% yield. Consider reviewing free cash flow against dividend payments in the linked 10-K sections.', age: '5h ago' }
      ],
      alerts: [
        { id: 'A1', type: 'breach', tk: 'JNJ', crit: true, mat: .95, title: 'Position cap breached: JNJ', body: 'JNJ is above your 10% maximum position rule.', src: 'Risk engine · rule R-POS', t: '2h ago' },
        { id: 'A2', type: 'breach', tk: 'KO', crit: true, mat: .90, title: 'Sector rule breached: Consumer Staples', body: 'Consumer Staples exceeds your 25% sector cap.', src: 'Risk engine · rule R-SEC', t: '2h ago' },
        { id: 'A3', type: 'filing', tk: 'KO', mat: .72, title: 'KO filed 8-K (Item 2.02): quarterly results', body: 'Coca-Cola reported Q3 results and reaffirmed full-year guidance.', src: 'SEC EDGAR 8-K + Finnhub news (2 sources, 1 alert)', t: '41m ago' },
        { id: 'A4', type: 'move', tk: 'VZ', mat: .66, title: 'VZ fell 4.1% (z = -2.3)', body: 'Largest one-day decline in 11 months, following the Q3 report.', src: 'Alpaca IEX · 15-min delayed', t: '1h ago' },
        { id: 'A5', type: 'filing', tk: 'XOM', mat: .48, title: 'XOM declared its quarterly dividend', body: '8-K Item 8.01: dividend unchanged at the prior quarter rate.', src: 'SEC EDGAR 8-K', t: '3h ago' },
        { id: 'A6', type: 'earnings', tk: 'PG', mat: .55, title: 'PG reports Q1 on Oct 31', body: 'Earnings fall in 2 days. You hold 60 shares (9.4% of portfolio).', src: 'Earnings calendar', t: 'Today' },
        { id: 'A7', type: 'mirror', tk: '', mat: .30, title: 'Weekly mirror: you made 1 trade in 7 days', body: 'Your rule allows 3 per week. Turnover over the last 12 months is 12%.', src: 'Behaviour detector · overtrading', t: 'Mon' }
      ],
      memories: [
        { id: 'm1', type: 'semantic', text: 'Prefers dividend-paying large caps and wants income to be stable.', conf: .9, src: 'Onboarding' },
        { id: 'm2', type: 'semantic', text: 'Excludes tobacco companies.', conf: 1.0, src: 'Onboarding' },
        { id: 'm3', type: 'episodic', text: 'Expanded the Balance sheet & dividend section on 9 of the last 10 briefs.', conf: .8, src: 'Events e-1004 to e-1031' },
        { id: 'm4', type: 'procedural', text: 'Reads TL;DR first, then opens Risks. Skips Catalysts.', conf: .7, src: 'Section dwell times' },
        { id: 'm5', type: 'episodic', text: 'Rejected one "reduce exposure" proposal for KO, reason: already know.', conf: .6, src: 'Proposal P-1988' }
      ],
      bias: [
        ['Overtrading', 'Trades per week', '1 (rule 3)', 'ok'], ['Disposition effect', 'PGR - PLR', '0.02 (flag at 0.10)', 'ok'],
        ['Concentration', 'HHI', 'calc', 'calc'], ['Herding', 'Buys within 2 days of a spike', '8% (flag at 40%)', 'ok'], ['Loss aversion', 'Reject ratio, losers vs winners', '1.1 (flag at 2.0)', 'ok']
      ],
      revealed: 2.3, gapDays: 0
    },
    alex: {
      id: 'alex', name: 'Alex Rivera', init: 'AR', tag: 'Aggressive growth · 2-year horizon',
      prof: { tier: 4, horizon: '1-3 years', goals: ['Growth'], exp: 'Intermediate', jargon: 2, depth: 'deep', excl: [], tone: 'Direct', metric: 'Revenue growth', lang: 'English', region: 'US · USD' },
      order: ['trend', 'cat', 'val', 'risk', 'moat', 'bal', 'bb'],
      cash: 7983, rules: { pos: 25, sec: 50, dd: 20, trades: 10, cash: 0 },
      hold: [['NVDA', 219, 121.5], ['AMD', 97, 158.9], ['TSLA', 38, 372.4], ['META', 14, 642.0], ['AMZN', 31, 219.6], ['AVGO', 17, 301.8]],
      watch: ['NVDA', 'AMD', 'TSLA', 'META', 'AMZN', 'AVGO', 'GOOGL', 'AAPL'],
      interest: [['Technology', .91], ['Growth', .88], ['Momentum', .72], ['Communication', .55], ['Consumer Discretionary', .50], ['Quality', .35], ['Dividend', .08], ['Healthcare', .10]],
      arms: { breach: [2, 1], proposal: [2, 3], filing: [3, 2], move: [5, 1], earnings: [4, 1], mirror: [1, 3], brief: [4, 1] },
      stats: { ytd: 24.5, spy: 11.9, vol: 48.3, beta: 1.74, dd: 18.2, maxdd: 21.6, turnover: 340, win: 54, real: 3180, revT: 4.6, pgr: 0.24, seed: 11, amp: 0.035 },
      orders: [[1, 'TSLA', 'buy', 10, 338.2], [1, 'AMD', 'sell', 20, 166.4], [2, 'NVDA', 'buy', 15, 178.9], [3, 'AMZN', 'buy', 8, 226.7], [3, 'META', 'sell', 4, 712.0], [4, 'AVGO', 'buy', 5, 348.8], [5, 'TSLA', 'sell', 6, 355.3], [6, 'AMD', 'buy', 25, 159.1], [6, 'NVDA', 'sell', 10, 176.0], [12, 'NVDA', 'buy', 40, 171.2]],
      proposals: [
        { id: 'P-3107', kind: 'trade', tk: 'NVDA', side: 'sell', rule: 'pos', title: 'Position above your 25% cap', age: '1h ago' },
        { id: 'P-3108', kind: 'trade', tk: 'AMD', side: 'sell', rule: 'sec', title: 'Technology above your 50% sector rule', age: '1h ago' },
        { id: 'P-3109', kind: 'review', tk: '', title: 'Review your trading pace: 9 trades in 7 days', body: 'Your rule allows 10 trades per week. In a study of 66,465 households, those who traded most earned 11.4% a year against 17.9% for the market. Consider reviewing whether each trade matched a written reason.', age: '3h ago' }
      ],
      alerts: [
        { id: 'A1', type: 'breach', tk: 'NVDA', crit: true, mat: .97, title: 'Position cap breached: NVDA', body: 'NVDA is above your 25% maximum position rule.', src: 'Risk engine · rule R-POS', t: '1h ago' },
        { id: 'A2', type: 'breach', tk: 'AMD', crit: true, mat: .92, title: 'Sector rule breached: Technology', body: 'Technology exceeds your 50% sector cap.', src: 'Risk engine · rule R-SEC', t: '1h ago' },
        { id: 'A3', type: 'move', tk: 'TSLA', mat: .78, title: 'TSLA rose 6.8% (z = +2.6)', body: 'Largest one-day gain in 5 months on no company filing.', src: 'Alpaca IEX · 15-min delayed', t: '34m ago' },
        { id: 'A4', type: 'filing', tk: 'AMD', mat: .74, title: 'AMD filed 8-K (Item 1.01): material agreement', body: 'Multi-year accelerator supply agreement with a cloud customer.', src: 'SEC EDGAR 8-K + Finnhub news (2 sources, 1 alert)', t: '2h ago' },
        { id: 'A5', type: 'earnings', tk: 'META', mat: .70, title: 'META reports today after the close', body: 'You hold 14 shares (10.1% of portfolio).', src: 'Earnings calendar', t: 'Today' },
        { id: 'A6', type: 'earnings', tk: 'NVDA', mat: .52, title: 'NVDA reports Nov 19', body: 'Your largest position reports in 21 days.', src: 'Earnings calendar', t: 'Today' },
        { id: 'A7', type: 'mirror', tk: '', mat: .58, title: 'Overtrading mirror: 9 trades in 7 days', body: 'Annualized turnover is 340%. The study average for households is 75%.', src: 'Behaviour detector · overtrading', t: '3h ago' },
        { id: 'A8', type: 'mirror', tk: 'TSLA', mat: .50, title: 'Disposition mirror: winners sold early', body: 'You realized 31% of gains and 7% of losses (difference 0.24, flag at 0.10).', src: 'Behaviour detector · disposition', t: 'Yesterday' }
      ],
      memories: [
        { id: 'm1', type: 'semantic', text: 'Targets growth and accepts large drawdowns; stated risk tier 4.', conf: .6, src: 'Onboarding' },
        { id: 'm2', type: 'episodic', text: 'Rejected 2 "reduce exposure" proposals for NVDA with reason: disagree with thesis.', conf: .8, src: 'Proposals P-3011, P-3052' },
        { id: 'm3', type: 'procedural', text: 'Opens Catalysts first and spends most time on Trend & growth.', conf: .85, src: 'Section dwell times' },
        { id: 'm4', type: 'episodic', text: 'Bought TSLA within 2 days of a 5% move in 4 of the last 6 buys.', conf: .7, src: 'Trade log' },
        { id: 'm5', type: 'semantic', text: 'Prefers revenue growth over dividend metrics.', conf: .75, src: 'Metric clicks' }
      ],
      bias: [
        ['Overtrading', 'Trades per week', '9 (rule 10)', 'watch'], ['Disposition effect', 'PGR - PLR', '0.24 (flag at 0.10)', 'flag'],
        ['Concentration', 'HHI', 'calc', 'calc'], ['Herding', 'Buys within 2 days of a spike', '67% (flag at 40%)', 'flag'], ['Loss aversion', 'Reject ratio, losers vs winners', '2.4 (flag at 2.0)', 'flag']
      ],
      revealed: 5.0, gapDays: 17
    }
  };

  const QUESTIONS = [
    ['Your portfolio falls 20% in one month. What do you do?', [['Sell everything', 1], ['Sell some to reduce risk', 2], ['Hold and wait', 4], ['Buy more at lower prices', 5]]],
    ['Which one-year outcome range would you accept?', [['+4% best case, -2% worst case', 1], ['+8% / -8%', 2], ['+14% / -16%', 3], ['+25% / -30%', 5]]],
    ['How stable is your income?', [['Variable; I may need this money soon', 1], ['Stable', 3], ['Very stable with regular surplus', 4]]],
    ['A stock you own rises 30% in two weeks.', [['Sell all to lock in the gain', 1], ['Sell part', 2], ['Hold', 3], ['Add to the position', 5]]],
    ['How would you feel about one stock being 20% of your portfolio?', [['Uncomfortable', 1], ['Acceptable for a high-conviction idea', 3], ['Comfortable', 5]]],
    ['Have you been invested through a market decline?', [['No', 2], ['Yes, and I held', 3], ['Yes, and I bought more', 5]]]
  ];
  const TIERS = ['', 'Very conservative', 'Conservative', 'Balanced', 'Growth', 'Aggressive'];
  const TIER_RULES = { 1: { pos: 10, sec: 25, dd: 10, trades: 3, cash: 10 }, 2: { pos: 10, sec: 25, dd: 10, trades: 3, cash: 10 }, 3: { pos: 15, sec: 35, dd: 15, trades: 5, cash: 5 }, 4: { pos: 25, sec: 50, dd: 25, trades: 10, cash: 0 }, 5: { pos: 25, sec: 50, dd: 25, trades: 10, cash: 0 } };

  const TRACES = [
    { id: 'tr-8f21', name: 'Brief: NVDA for Alex', model: 'muse-spark-1.3-contributor', mode: 'Contributor · public data', ms: 14820, tin: 31240, tout: 2180, cost: 0.041, ok: 'ok', steps: [
      ['PromptGuard 2 scan of 42 chunks', 310, 'ok', '0 flagged'], ['Hybrid retrieval (pgvector + full text) + rerank', 640, 'ok', '20 chunks to 6'], ['Tool: get_xbrl_metric Revenues FY2025', 180, 'ok', '130.5B'], ['Tool: compute_ratio P/E', 12, 'ok', '41.2'], ['Muse Spark 1.3 structured output (reasoning: low)', 11200, 'ok', '2,180 tokens'], ['Verifier: 24 numeric tokens vs tool ledger', 95, 'ok', '24 / 24 matched'], ['Citation enforcer: 18 factual sentences', 60, 'ok', '18 / 18 cited'], ['Personalization: order sections from style_card', 8, 'ok', 'Alex profile v14']] },
    { id: 'tr-8f22', name: 'Brief: NVDA for Priya', model: 'muse-spark-1.3-contributor', mode: 'Contributor · public data', ms: 13970, tin: 30980, tout: 2050, cost: 0.039, ok: 'ok', steps: [
      ['PromptGuard 2 scan of 42 chunks', 305, 'ok', '0 flagged'], ['Hybrid retrieval + rerank', 610, 'ok', '20 chunks to 6'], ['Muse Spark 1.3 structured output (reasoning: low)', 10400, 'ok', '2,050 tokens'], ['Verifier: 22 numeric tokens', 90, 'ok', '22 / 22 matched'], ['Personalization: plain-language glossary on', 8, 'ok', 'Priya profile v9']] },
    { id: 'tr-8f30', name: 'Chat: "What is my concentration?"', model: 'muse-spark-1.3', mode: 'Standard · contains portfolio data', ms: 3120, tin: 4210, tout: 380, cost: 0.007, ok: 'ok', steps: [
      ['Llama Guard 4 input check', 120, 'ok', 'safe'], ['Tool: get_portfolio', 40, 'ok', '6 positions'], ['Tool: evaluate_risk', 22, 'ok', 'HHI 0.26'], ['Muse Spark 1.3 narration', 2700, 'ok', '380 tokens'], ['Llama Guard 4 output check', 110, 'ok', 'safe']] },
    { id: 'tr-8f3b', name: 'Injected 10-K chunk (test set 07)', model: 'n/a', mode: 'Blocked before LLM', ms: 290, tin: 0, tout: 0, cost: 0, ok: 'blocked', steps: [
      ['Fetch filing chunk from allowlisted host sec.gov', 120, 'ok', '1 chunk'], ['PromptGuard 2 scan', 170, 'bad', 'Injection score 0.99'], ['Chunk excluded; document wrapped as untrusted', 0, 'ok', 'Not sent to model']] },
    { id: 'tr-8f44', name: 'Chat: "Guarantee me 20% returns"', model: 'n/a', mode: 'Refused by output policy', ms: 410, tin: 0, tout: 0, cost: 0, ok: 'blocked', steps: [
      ['Llama Guard 4 input check', 130, 'bad', 'Return-guarantee request'], ['Refusal template + educational redirect', 12, 'ok', 'No guarantee phrases']] }
  ];

  const EVALS = [
    ['T-RAG-01', 'Revenue answer equals XBRL value and cites accession no.', '100% numeric match', '30 / 30', 'pass'],
    ['T-RAG-02', 'Every numeric token maps to a tool-ledger entry', '0 unverified', '0 unverified', 'pass'],
    ['T-RAG-03', 'Citation coverage of factual sentences', '>= 95%', '97.4%', 'pass'],
    ['T-RAG-04', 'Faithfulness (Ragas), hallucination rate', '>= 0.90, <= 2%', '0.93, 1.4%', 'pass'],
    ['T-RAG-05', 'Refusal correctness on unanswerable questions', '>= 90%', '92%', 'pass'],
    ['T-RISK-02', 'Ranking never shows an item that breaches a rule', '0 shown', '0 shown', 'pass'],
    ['T-PAPER-02', '4:1 split leaves P&L unchanged', 'Exact', 'Exact', 'pass'],
    ['T-ALERT-01', 'Same 8-K from 2 sources yields 1 alert', '1 alert', '1 alert', 'pass'],
    ['T-ALERT-02', '8-K published to alert in feed, p95', '<= 5 min', '3.8 min', 'pass'],
    ['T-PERS-02', 'NDCG@5 after 30 scripted events', '>= 0.80', '0.84', 'pass'],
    ['T-PERS-07', 'Two personas, same ticker: section order diff', '>= 30%', '57%', 'pass'],
    ['T-SEC-01', 'Injection test set blocked or neutralized', '25 / 25', '25 / 25', 'pass'],
    ['T-SEC-03', 'User A reads user B portfolio (RLS)', '403 / 404', '404', 'pass'],
    ['T-PERF-01', 'Dashboard load p95 (cached)', '< 1.5 s', '1.2 s', 'pass'],
    ['T-A11Y-01', 'axe-core critical violations on main pages', '0', '0', 'pass']
  ];

  return { U, list, SECS, PLAIN, PERSONAS, QUESTIONS, TIERS, TIER_RULES, TRACES, EVALS };
})();
