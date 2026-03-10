-- Add difficulty column and user preferences (already applied via 033 update)
-- This migration adds the comprehensive lesson library

-- PERSONAL FINANCE - BASIC
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Pay Yourself First', 'Before paying bills or spending on wants, set aside a portion of every paycheck for savings and investments — even 10% adds up dramatically over time.', 'personal_finance', 'basic'),
('The 50/30/20 Budget Rule', 'A simple budgeting framework: spend 50% of your after-tax income on needs, 30% on wants, and 20% on savings and debt repayment.', 'personal_finance', 'basic'),
('Emergency Fund Essentials', 'Keep 3 to 6 months of living expenses in a savings account so unexpected costs like car repairs or medical bills never force you into debt.', 'personal_finance', 'basic'),
('Good Debt vs. Bad Debt', 'Debt used to buy appreciating assets like education or a home can build wealth, while high-interest debt on depreciating items like credit cards destroys it.', 'personal_finance', 'basic'),
('The Rule of 72', 'Divide 72 by your annual return rate to estimate how many years it takes to double your money — at 8% growth, your money doubles roughly every 9 years.', 'personal_finance', 'basic'),
('Credit Score Basics', 'Your credit score is a number (300-850) that tells lenders how reliable you are — a higher score means lower interest rates on loans, saving you thousands over your lifetime.', 'personal_finance', 'basic'),
('Compound Interest Works Both Ways', 'Compound interest grows your savings exponentially, but it also grows your debt — a credit card at 20% interest can double what you owe in less than 4 years.', 'personal_finance', 'basic'),
('Start Investing Early', 'Someone who invests $200/month starting at age 20 will have significantly more at retirement than someone who invests $400/month starting at age 30, thanks to compounding.', 'personal_finance', 'basic'),
('Wants vs. Needs', 'Before every purchase, ask yourself: "Do I need this, or do I want this?" — this one habit alone can save thousands of dollars per year.', 'personal_finance', 'basic'),
('The Latte Factor', 'Small daily expenses like $5 coffee add up to $1,825 per year — invested at 8% annually over 30 years, that becomes over $200,000.', 'personal_finance', 'basic'),
('Inflation Eats Your Cash', 'Money sitting in a checking account loses about 2-3% of its purchasing power every year to inflation, which is why investing is essential to preserving wealth.', 'personal_finance', 'basic'),
('Tax-Advantaged Accounts', 'Accounts like 401(k)s and Roth IRAs let your money grow tax-free or tax-deferred, meaning more of your returns stay in your pocket instead of going to the government.', 'personal_finance', 'basic'),
('The Power of Employer Match', 'If your employer matches 401(k) contributions, always contribute enough to get the full match — it is literally free money and an instant 100% return on your investment.', 'personal_finance', 'basic'),
('Lifestyle Creep', 'As your income grows, resist the urge to increase spending at the same rate — investing the difference between raises and expenses is how ordinary earners build real wealth.', 'personal_finance', 'basic'),
('Opportunity Cost', 'Every dollar you spend is a dollar you cannot invest — that $50 dinner out could have grown to $500 over 30 years in the stock market.', 'personal_finance', 'basic'),
('Insurance Is Not Optional', 'Health, auto, and renters insurance protect you from financial catastrophe — one uninsured hospital visit or car accident can wipe out years of savings.', 'personal_finance', 'basic'),
('Automate Your Finances', 'Set up automatic transfers to savings and investment accounts on payday so you never have to rely on willpower to build wealth.', 'personal_finance', 'basic'),
('Net Worth Is What Matters', 'Your net worth (assets minus liabilities) is a better measure of financial health than your income — someone earning $50K with no debt can be wealthier than someone earning $200K buried in loans.', 'personal_finance', 'basic'),
('The Debt Snowball Method', 'Pay off your smallest debt first while making minimum payments on the rest — the psychological win of eliminating a debt motivates you to keep going.', 'personal_finance', 'basic'),
('The Debt Avalanche Method', 'Pay off the debt with the highest interest rate first to minimize total interest paid — this is mathematically the fastest way to become debt-free.', 'personal_finance', 'basic');

-- PERSONAL FINANCE - ADVANCED
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Tax-Loss Harvesting', 'Selling investments at a loss to offset capital gains taxes is a legal strategy that can save you thousands — just be careful of the wash-sale rule that prevents repurchasing the same stock within 30 days.', 'personal_finance', 'advanced'),
('Roth Conversion Ladder', 'Converting traditional IRA funds to a Roth IRA in low-income years lets you pay taxes at a lower rate now and withdraw tax-free in retirement.', 'personal_finance', 'advanced'),
('Asset Location Strategy', 'Place tax-inefficient investments (like bonds) in tax-advantaged accounts and tax-efficient investments (like index funds) in taxable accounts to minimize your overall tax burden.', 'personal_finance', 'advanced'),
('Backdoor Roth IRA', 'High earners who exceed Roth IRA income limits can contribute to a traditional IRA and then convert it to a Roth — a legal workaround used by many wealthy investors.', 'personal_finance', 'advanced'),
('Health Savings Account Triple Tax Benefit', 'An HSA offers tax-deductible contributions, tax-free growth, and tax-free withdrawals for medical expenses — making it one of the most powerful savings vehicles available.', 'personal_finance', 'advanced'),
('Marginal vs. Effective Tax Rate', 'Your marginal tax rate is the rate on your last dollar earned, while your effective rate is the average across all your income — understanding the difference prevents overpaying in taxes.', 'personal_finance', 'advanced'),
('Estate Planning Basics', 'Without a will or trust, the state decides who inherits your assets — simple estate planning ensures your wealth goes where you intend and minimizes taxes for your heirs.', 'personal_finance', 'advanced'),
('Umbrella Insurance', 'For a few hundred dollars per year, umbrella insurance provides an extra $1-5 million in liability protection beyond your auto and home policies — essential once you have significant assets.', 'personal_finance', 'advanced'),
('The 4% Rule for Retirement', 'Research suggests you can withdraw 4% of your retirement portfolio in the first year and adjust for inflation each year after, giving you a high probability your money lasts 30+ years.', 'personal_finance', 'advanced'),
('Capital Gains Tax Brackets', 'Long-term capital gains (held over 1 year) are taxed at 0%, 15%, or 20% depending on your income — significantly lower than ordinary income tax rates, rewarding patient investors.', 'personal_finance', 'advanced');

-- DIVERSIFICATION
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Don''t Put All Eggs in One Basket', 'Owning stocks in at least 5-7 different sectors (Technology, Healthcare, Energy, etc.) means a downturn in one area won''t devastate your entire portfolio.', 'diversification', 'basic'),
('Geographic Diversification', 'Investing in both U.S. and international stocks protects you if one country''s economy struggles while another thrives.', 'diversification', 'basic'),
('Asset Class Diversification', 'Stocks, bonds, real estate, and commodities all behave differently — combining them smooths out your portfolio''s ups and downs over time.', 'diversification', 'basic'),
('Small Cap vs. Large Cap', 'Large companies like Apple are more stable, while small companies have more growth potential but higher risk — holding both gives you stability and upside.', 'diversification', 'basic'),
('Index Funds for Instant Diversification', 'A single S&P 500 index fund gives you ownership in 500 companies at once, providing broad diversification for just a few dollars in fees.', 'diversification', 'basic'),
('Correlation and Diversification', 'True diversification means owning assets that don''t move in the same direction — stocks and bonds often move opposite to each other, which is why portfolios hold both.', 'diversification', 'advanced'),
('Over-Diversification', 'Owning too many similar investments (called "diworsification") can dilute your returns without meaningfully reducing risk — 20-30 well-chosen stocks often provide sufficient diversification.', 'diversification', 'advanced'),
('Rebalancing Your Portfolio', 'If one sector grows and becomes too large a percentage of your portfolio, selling some and buying underweight sectors restores your target allocation and locks in gains.', 'diversification', 'advanced');

-- RISK
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Risk and Reward Are Connected', 'Higher potential returns always come with higher risk — if an investment promises huge gains with no risk, it is almost certainly a scam.', 'risk', 'basic'),
('Time Reduces Risk', 'The stock market has never lost money over any 20-year period in history — the longer you hold, the more likely you are to earn positive returns.', 'risk', 'basic'),
('Know Your Risk Tolerance', 'If watching your portfolio drop 20% would cause you to panic-sell, you need a more conservative mix — the best portfolio is one you can stick with through downturns.', 'risk', 'basic'),
('Market Corrections Are Normal', 'The stock market drops 10% or more about once every 1-2 years on average — these corrections are healthy and often create buying opportunities for patient investors.', 'risk', 'basic'),
('Bear Markets Don''t Last Forever', 'The average bear market (a drop of 20% or more) lasts about 9-16 months, while the average bull market lasts about 3-5 years — time is on the side of long-term investors.', 'risk', 'basic'),
('Systematic vs. Unsystematic Risk', 'Market-wide risk (like a recession) affects all stocks, but company-specific risk (like a CEO scandal) can be reduced through diversification — you can control one but not the other.', 'risk', 'advanced'),
('Beta Measures Volatility', 'A stock with a beta of 1.5 moves 50% more than the market — when the S&P 500 rises 10%, that stock tends to rise 15%, but it also falls 15% when the market drops 10%.', 'risk', 'advanced'),
('Standard Deviation in Investing', 'Standard deviation measures how much a stock''s returns vary from its average — a higher number means more unpredictable returns and therefore higher risk.', 'risk', 'advanced'),
('The Sharpe Ratio', 'The Sharpe ratio measures return per unit of risk — a higher Sharpe ratio means you are getting more reward for each unit of volatility you are taking on.', 'risk', 'advanced'),
('Black Swan Events', 'Rare, unpredictable events like the 2008 financial crisis or COVID crash can cause extreme losses — this is why even aggressive investors should hold some defensive assets.', 'risk', 'advanced'),
('Maximum Drawdown', 'Maximum drawdown measures the largest peak-to-trough decline in a portfolio''s history — knowing this helps you prepare mentally for the worst-case scenario of any investment strategy.', 'risk', 'advanced');

-- SECTOR
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('The 11 Market Sectors', 'The stock market is divided into 11 sectors: Technology, Healthcare, Financials, Consumer Discretionary, Consumer Staples, Energy, Industrials, Materials, Utilities, Real Estate, and Communication Services.', 'sector', 'basic'),
('Technology Sector', 'Tech companies like Apple, Microsoft, and NVIDIA drive innovation and often deliver high growth, but they can also be highly volatile when investor expectations change.', 'sector', 'basic'),
('Healthcare Sector', 'Healthcare companies (pharmaceuticals, biotech, hospitals) tend to be more recession-resistant because people need medical care regardless of the economy.', 'sector', 'basic'),
('Energy Sector', 'Energy companies like ExxonMobil and Chevron are tied to oil and gas prices — when oil prices rise, energy stocks tend to surge, and vice versa.', 'sector', 'basic'),
('Consumer Staples vs. Discretionary', 'Staples (toothpaste, groceries) sell well in any economy, while discretionary (luxury goods, restaurants) thrive in good times — holding both balances your exposure to economic cycles.', 'sector', 'basic'),
('Financial Sector', 'Banks and insurance companies profit when interest rates rise because they earn more on loans — this is why financial stocks often rally when the Federal Reserve raises rates.', 'sector', 'basic'),
('Utilities as Defensive Stocks', 'Utility companies (electric, water, gas) provide essential services and pay steady dividends, making them safe havens during market downturns.', 'sector', 'basic'),
('Real Estate Sector and REITs', 'Real Estate Investment Trusts (REITs) let you invest in property without buying buildings — they are required to pay out 90% of income as dividends, making them popular for income investors.', 'sector', 'basic'),
('Cyclical vs. Defensive Sectors', 'Cyclical sectors (Tech, Industrials, Consumer Discretionary) outperform during economic expansion, while defensive sectors (Utilities, Healthcare, Staples) hold up better during recessions.', 'sector', 'advanced'),
('Sector Weightings in the S&P 500', 'Technology makes up nearly 30% of the S&P 500, so owning an index fund means you already have heavy tech exposure — be aware of this before adding more individual tech stocks.', 'sector', 'advanced'),
('Sector ETFs for Targeted Exposure', 'Sector-specific ETFs like XLK (Technology) or XLE (Energy) let you invest in an entire sector without picking individual stocks, reducing company-specific risk.', 'sector', 'advanced'),
('Interest Rate Sensitivity by Sector', 'When interest rates rise, rate-sensitive sectors like Real Estate and Utilities often decline because their dividend yields become less attractive compared to bonds.', 'sector', 'advanced');

-- STRATEGY
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Buy and Hold', 'Buying quality stocks and holding them for years or decades has outperformed almost every other strategy — legendary investor Warren Buffett''s favorite holding period is "forever."', 'strategy', 'basic'),
('Don''t Try to Time the Market', 'Missing just the 10 best trading days over a 20-year period can cut your returns in half — staying invested through ups and downs beats trying to guess market moves.', 'strategy', 'basic'),
('Value Investing', 'Buying stocks that trade below their true worth (like a $1 bill selling for $0.70) is the foundation of value investing, made famous by Warren Buffett and Benjamin Graham.', 'strategy', 'basic'),
('Growth Investing', 'Growth investors buy companies with rapidly increasing revenue and earnings, willing to pay higher prices today for the expectation of much larger profits tomorrow.', 'strategy', 'basic'),
('Dividend Investing', 'Companies that consistently pay and raise dividends (called Dividend Aristocrats) provide a steady income stream and tend to be financially stable, well-managed businesses.', 'strategy', 'basic'),
('The Buy Low, Sell High Principle', 'It sounds simple, but most investors do the opposite — they buy when stocks are popular (high) and sell when they are scared (low), which is why discipline beats emotion.', 'strategy', 'basic'),
('Paper Trading Before Real Money', 'Practice investing with a simulated portfolio before risking real money — it teaches you how markets work and how you react emotionally to gains and losses.', 'strategy', 'basic'),
('Momentum Investing', 'Stocks that have been rising tend to keep rising in the short term, and stocks that have been falling tend to keep falling — momentum strategies try to ride these trends.', 'strategy', 'advanced'),
('Contrarian Investing', 'Buying when others are fearful and selling when others are greedy often leads to the best long-term results — the best time to invest is usually when it feels the scariest.', 'strategy', 'advanced'),
('Position Sizing', 'No single stock should represent more than 5-10% of your total portfolio — this limits the damage if any one company has a catastrophic event.', 'strategy', 'advanced'),
('Stop-Loss Orders', 'A stop-loss order automatically sells your stock if it drops to a set price, protecting you from large losses — but setting it too tight can trigger unnecessary sells during normal volatility.', 'strategy', 'advanced'),
('Core and Satellite Strategy', 'Keep 70-80% of your portfolio in broad index funds (the core) and use 20-30% for individual stock picks or sector bets (satellites) to balance stability with growth potential.', 'strategy', 'advanced'),
('Tax-Efficient Investing', 'Holding stocks for more than one year qualifies you for the lower long-term capital gains tax rate — selling before one year means your profits are taxed at your higher ordinary income rate.', 'strategy', 'advanced');

-- LONG-TERM
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Time in the Market Beats Timing the Market', 'A dollar invested in the S&P 500 in 1970 would be worth over $150 today — patience and consistency are the most reliable paths to wealth.', 'long-term', 'basic'),
('The Power of Starting Young', 'Thanks to compounding, a 20-year-old who invests $5,000 per year until age 30 and then stops can end up with more money at 65 than someone who starts at 30 and invests $5,000 every year until 65.', 'long-term', 'basic'),
('Reinvesting Dividends', 'Reinvesting your dividends to buy more shares creates a compounding snowball — over decades, reinvested dividends can account for more than half of your total returns.', 'long-term', 'basic'),
('Think in Decades, Not Days', 'The best investors think about where a company will be in 10 years, not where the stock price will be next week — short-term noise is irrelevant to long-term wealth building.', 'long-term', 'basic'),
('Historical Market Returns', 'The U.S. stock market has returned an average of about 10% per year over the last 100 years — through world wars, pandemics, recessions, and crises, it has always recovered.', 'long-term', 'basic'),
('Patience Is a Competitive Advantage', 'Most investors underperform because they trade too often — studies show that the less frequently you check your portfolio and trade, the better your returns tend to be.', 'long-term', 'basic'),
('The Cost of Waiting', 'Every year you delay investing costs you significantly — waiting 5 years to start can reduce your retirement wealth by 30% or more due to lost compounding.', 'long-term', 'basic'),
('Sequence of Returns Risk', 'Big losses early in retirement can devastate your portfolio even if markets recover later — this is why retirees should gradually shift to more conservative investments as they approach retirement.', 'long-term', 'advanced'),
('Dollar Weighted vs. Time Weighted Returns', 'Your actual returns depend on when you add or withdraw money — investing a lump sum right before a crash hurts more than the same amount invested gradually over time.', 'long-term', 'advanced'),
('The Magic of 10,000 Hours (in Investing)', 'Developing investment expertise takes years of reading, analyzing, and learning from mistakes — treat your early years as tuition and your later years will generate the returns.', 'long-term', 'advanced');

-- RESEARCH
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Read the Annual Report', 'A company''s annual report (10-K filing) tells you everything about its revenue, expenses, risks, and strategy — it is the single most important document an investor can read.', 'research', 'basic'),
('Earnings Per Share (EPS)', 'EPS tells you how much profit a company earns for each share of stock — rising EPS over time is one of the strongest signals that a company is healthy and growing.', 'research', 'basic'),
('Revenue vs. Profit', 'Revenue is total sales, but profit is what remains after expenses — a company can have billions in revenue but still lose money if costs are too high.', 'research', 'basic'),
('What Is a Balance Sheet?', 'A balance sheet shows what a company owns (assets), what it owes (liabilities), and what shareholders own (equity) — it is a snapshot of a company''s financial health.', 'research', 'basic'),
('Competitive Moats', 'Warren Buffett looks for companies with "moats" — durable advantages like strong brands, patents, or network effects that protect profits from competitors.', 'research', 'basic'),
('Management Matters', 'Great companies are led by honest, capable leaders — look for CEOs with a track record of smart capital allocation, clear communication, and skin in the game (owning company stock).', 'research', 'basic'),
('Understand the Business Model', 'Before investing, you should be able to explain in one sentence how the company makes money — if you cannot, you do not understand it well enough to invest.', 'research', 'basic'),
('Follow the Cash Flow', 'Free cash flow (operating cash minus capital expenditures) is harder to manipulate than earnings and shows how much real cash a company generates for shareholders.', 'research', 'advanced'),
('Price-to-Earnings Ratio (P/E)', 'The P/E ratio tells you how much investors are paying for each dollar of earnings — a P/E of 20 means investors pay $20 for every $1 of profit, which helps gauge if a stock is expensive or cheap.', 'research', 'advanced'),
('Price-to-Book Ratio (P/B)', 'The P/B ratio compares a stock''s market price to its book value (assets minus liabilities) — a ratio below 1 might mean the stock is undervalued, while a high ratio could mean it is overpriced.', 'research', 'advanced'),
('Debt-to-Equity Ratio', 'This ratio shows how much a company relies on debt vs. shareholder equity to finance its operations — high debt can amplify returns in good times but can be fatal during downturns.', 'research', 'advanced'),
('Return on Equity (ROE)', 'ROE measures how efficiently a company uses shareholder money to generate profit — an ROE consistently above 15% often indicates an exceptional business with a competitive advantage.', 'research', 'advanced'),
('Insider Buying and Selling', 'When company executives buy their own stock with personal money, it is a strong bullish signal — they know the company best and are putting their own wealth at risk.', 'research', 'advanced'),
('Reading Earnings Calls', 'Quarterly earnings calls let you hear management discuss results and answer analyst questions — the tone and specificity of their answers can reveal more than the numbers alone.', 'research', 'advanced'),
('Discounted Cash Flow Analysis', 'DCF analysis estimates a company''s value by projecting future cash flows and discounting them to today''s dollars — it is the gold standard of intrinsic value calculation.', 'research', 'advanced');

-- BEHAVIORAL FINANCE
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Confirmation Bias', 'Investors tend to seek information that confirms what they already believe and ignore evidence that contradicts it — always look for reasons your investment thesis could be wrong.', 'behavioral_finance', 'basic'),
('Herd Mentality', 'Just because everyone is buying a stock doesn''t mean it is a good investment — some of the worst losses happen when people follow the crowd into overpriced assets.', 'behavioral_finance', 'basic'),
('Loss Aversion', 'Studies show that the pain of losing $100 feels twice as intense as the pleasure of gaining $100 — this causes investors to hold losers too long and sell winners too early.', 'behavioral_finance', 'basic'),
('Recency Bias', 'People overweight recent events when making decisions — just because the market dropped last week does not mean it will drop next week, and a recent rally does not guarantee continued gains.', 'behavioral_finance', 'basic'),
('FOMO in Investing', 'Fear of Missing Out drives people to buy at the top of rallies — by the time a hot stock is on the news and social media, most of the gains have already happened.', 'behavioral_finance', 'basic'),
('Anchoring Bias', 'Investors often anchor to the price they paid for a stock, refusing to sell at a loss — but the market does not care what you paid, only what the stock is worth today.', 'behavioral_finance', 'basic'),
('Overconfidence Bias', 'After a few winning trades, investors often believe they have special skill and take bigger risks — overconfidence is responsible for more portfolio blowups than any other behavioral trap.', 'behavioral_finance', 'advanced'),
('Disposition Effect', 'Investors have a tendency to sell winning stocks too quickly to lock in gains and hold losing stocks too long hoping they will recover — the best investors do the opposite.', 'behavioral_finance', 'advanced'),
('Narrative Fallacy', 'A compelling story about a company can trick you into ignoring poor fundamentals — always verify exciting narratives with actual financial data before investing.', 'behavioral_finance', 'advanced'),
('Sunk Cost Fallacy', 'Money already lost in a bad investment is gone forever — holding a losing stock just because you already put money into it leads to even larger losses.', 'behavioral_finance', 'advanced');

-- MARKET MECHANICS
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('What Is a Stock?', 'A stock represents ownership in a real company — when you buy a share of Apple, you literally own a tiny piece of all their stores, products, cash, and future profits.', 'market_mechanics', 'basic'),
('How Stock Prices Move', 'Stock prices go up when more people want to buy than sell, and down when more want to sell than buy — at its core, the market is simply supply and demand.', 'market_mechanics', 'basic'),
('What Is a Dividend?', 'A dividend is a portion of a company''s profits paid directly to shareholders, usually quarterly — it is like receiving rent for owning a piece of the business.', 'market_mechanics', 'basic'),
('Market Cap Explained', 'Market capitalization (share price times total shares) tells you a company''s total value — Apple at $3 trillion is a mega-cap, while a $500 million company is a small-cap.', 'market_mechanics', 'basic'),
('Bull vs. Bear Markets', 'A bull market means stocks are rising 20%+ from recent lows (optimism), while a bear market means stocks have fallen 20%+ from recent highs (pessimism).', 'market_mechanics', 'basic'),
('What Is the S&P 500?', 'The S&P 500 is an index of the 500 largest U.S. companies and is the most common benchmark for stock market performance — beating it consistently is the goal of active investors.', 'market_mechanics', 'basic'),
('Market Hours and After-Hours Trading', 'U.S. stock markets are open 9:30 AM to 4:00 PM Eastern Time on weekdays — after-hours trading is possible but has lower volume and wider price spreads.', 'market_mechanics', 'basic'),
('Bid-Ask Spread', 'The bid is what buyers will pay and the ask is what sellers want — the difference (the spread) is a hidden cost of trading, and it is wider for less-traded stocks.', 'market_mechanics', 'basic'),
('What Is an ETF?', 'An Exchange-Traded Fund (ETF) bundles many stocks into one tradable security — you can buy a whole sector, country, or market index in a single purchase.', 'market_mechanics', 'basic'),
('Limit Orders vs. Market Orders', 'A market order buys immediately at the current price, while a limit order only executes at your specified price or better — limit orders give you more control, especially in volatile markets.', 'market_mechanics', 'basic'),
('Short Selling Explained', 'Short sellers borrow and sell shares they don''t own, hoping to buy them back cheaper later — it is risky because losses are theoretically unlimited if the stock keeps rising.', 'market_mechanics', 'advanced'),
('Market Makers and Liquidity', 'Market makers are firms that always stand ready to buy or sell stocks, ensuring you can trade any time the market is open — they profit from the bid-ask spread.', 'market_mechanics', 'advanced'),
('IPOs: Initial Public Offerings', 'When a private company sells shares to the public for the first time, it is called an IPO — while exciting, IPOs are often overpriced and historically underperform the market in their first year.', 'market_mechanics', 'advanced'),
('Stock Splits', 'A stock split (like 4-for-1) divides each share into more shares at a lower price without changing the company''s value — it makes shares more accessible but does not make you richer.', 'market_mechanics', 'advanced'),
('The Federal Reserve and Markets', 'The Federal Reserve controls interest rates, which heavily influence stock prices — lower rates make borrowing cheaper and boost stocks, while higher rates slow the economy and pressure stock prices.', 'market_mechanics', 'advanced');

-- DIVIDENDS
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Dividend Yield', 'Dividend yield is the annual dividend divided by the stock price — a $100 stock paying $3 per year has a 3% yield, which you can compare to other income sources like savings accounts.', 'dividends', 'basic'),
('Dividend Aristocrats', 'Companies that have raised their dividends for 25+ consecutive years are called Dividend Aristocrats — this track record signals financial strength and management discipline.', 'dividends', 'basic'),
('Dividends as Passive Income', 'A $100,000 portfolio with a 3% dividend yield generates $3,000 per year in passive income without selling a single share — this is how retirees live off their investments.', 'dividends', 'basic'),
('Ex-Dividend Date', 'You must own a stock before its ex-dividend date to receive the next dividend payment — buying on or after that date means the seller, not you, gets the dividend.', 'dividends', 'basic'),
('DRIP: Dividend Reinvestment Plan', 'A DRIP automatically uses your dividend payments to buy more shares — over decades this creates a powerful compounding effect as your share count grows every quarter.', 'dividends', 'basic'),
('Dividend Payout Ratio', 'The payout ratio shows what percentage of earnings a company pays as dividends — a ratio above 80% may be unsustainable, while below 50% leaves room for dividend growth and reinvestment.', 'dividends', 'advanced'),
('High Yield Can Be a Trap', 'An unusually high dividend yield (above 7-8%) often signals that the stock price has crashed due to problems — the dividend may be about to get cut, so always investigate why the yield is so high.', 'dividends', 'advanced'),
('Qualified vs. Ordinary Dividends', 'Qualified dividends from U.S. stocks held over 60 days are taxed at the lower capital gains rate (0-20%), while ordinary dividends are taxed at your regular income rate — this affects your after-tax return.', 'dividends', 'advanced');

-- VALUATION
INSERT INTO investment_lessons (title, content, lesson_type, difficulty) VALUES
('Intrinsic Value', 'Every stock has an intrinsic value based on its fundamentals — smart investors buy when the market price is below this value and sell when it is above.', 'valuation', 'basic'),
('Margin of Safety', 'Benjamin Graham taught that you should only buy a stock when it trades well below your estimate of its value — this "margin of safety" protects you from being wrong in your analysis.', 'valuation', 'basic'),
('Growth at a Reasonable Price (GARP)', 'GARP investors look for companies growing faster than average but trading at reasonable valuations — they avoid both overpriced growth stocks and cheap companies with no growth.', 'valuation', 'advanced'),
('PEG Ratio', 'The PEG ratio divides the P/E ratio by the earnings growth rate — a PEG below 1 suggests the stock may be undervalued relative to its growth, while above 2 suggests it may be overpriced.', 'valuation', 'advanced'),
('Enterprise Value vs. Market Cap', 'Enterprise value includes a company''s debt and subtracts its cash, giving a more complete picture of what it would cost to buy the entire business than market cap alone.', 'valuation', 'advanced'),
('Book Value and Tangible Assets', 'Book value represents the net assets on a company''s balance sheet — comparing it to market price helps you determine if you are paying for real assets or mostly for intangible expectations.', 'valuation', 'advanced');
