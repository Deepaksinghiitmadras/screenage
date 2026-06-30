declare global {
    type MarketIndex = {
        name: string;
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
        currency?: string;
    };

    type MarketMover = {
        symbol: string;
        name: string;
        price: number;
        change: number;
        changePercent: number;
        volume?: number;
    };

    type MarketMovers = {
        gainers: MarketMover[];
        losers: MarketMover[];
        mostActive: MarketMover[];
    };

    type HeatmapCell = {
        symbol: string;
        sector: string;
        weight: number;
        price: number;
        changePercent: number;
    };

    type StockFundamentalMetrics = {
        marketCap: number | null;
        enterpriseValue: number | null;
        trailingPE: number | null;
        forwardPE: number | null;
        priceToBook: number | null;
        pegRatio: number | null;
        eps: number | null;
        beta: number | null;
        dividendYield: number | null;
        bookValue: number | null;
        roe: number | null;
        roa: number | null;
        profitMargin: number | null;
        operatingMargin: number | null;
        revenue: number | null;
        grossProfit: number | null;
        ebitda: number | null;
        debtToEquity: number | null;
        currentRatio: number | null;
        revenueGrowth: number | null;
        earningsGrowth: number | null;
    };

    type StockAnalystView = {
        recommendation: string | null;
        targetMean: number | null;
        targetHigh: number | null;
        targetLow: number | null;
        numberOfAnalysts: number | null;
    };

    type StockFundamentals = {
        symbol: string;
        name: string;
        exchange: string | null;
        currency: string | null;
        sector: string | null;
        industry: string | null;
        website: string | null;
        summary: string | null;
        price: number | null;
        previousClose: number | null;
        change: number | null;
        changePercent: number | null;
        dayHigh: number | null;
        dayLow: number | null;
        fiftyTwoWeekHigh: number | null;
        fiftyTwoWeekLow: number | null;
        metrics: StockFundamentalMetrics;
        analyst: StockAnalystView;
    };

    type StockCandle = {
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    };

    type StockHistory = {
        symbol: string;
        range: string;
        candles: StockCandle[];
    };

    type PortfolioHoldingInput = {
        symbol: string;
        company: string;
        quantity: number;
        avgPrice: number;
        buyDate?: string | null;
    };

    type PortfolioHolding = {
        symbol: string;
        company: string;
        sector: string;
        quantity: number;
        avgPrice: number;
        buyDate: string | null;
        price: number | null;
        changePercent: number | null;
        invested: number;
        currentValue: number;
        pnl: number;
        pnlPct: number;
        dayPnl: number;
        weightPct: number;
        available: boolean;
    };

    type PortfolioAllocationSlice = { label: string; value: number; pct: number };

    type PortfolioRedFlag = { severity: 'high' | 'medium' | 'low'; label: string; detail: string };

    type PortfolioSummary = {
        invested: number;
        currentValue: number;
        totalPnl: number;
        totalPnlPct: number;
        dayPnl: number;
        dayPnlPct: number;
        annualizedPct: number | null;
        diversificationScore: number;
        holdings: number;
    };

    type PortfolioResult = {
        available: boolean;
        summary: PortfolioSummary;
        holdings: PortfolioHolding[];
        bySector: PortfolioAllocationSlice[];
        byStock: PortfolioAllocationSlice[];
        redFlags: PortfolioRedFlag[];
        error?: string;
    };

    type WatchlistQuote = {
        requested: string;
        symbol: string;
        available: boolean;
        price?: number;
        open?: number;
        dayHigh?: number;
        dayLow?: number;
        previousClose?: number;
        change?: number;
        changePercent?: number;
        volume?: number;
        week52High?: number;
        week52Low?: number;
        sparkline?: number[];
    };

    type AIAnalysisStance = 'Bullish' | 'Bearish' | 'Neutral';
    type AIAnalysisConfidence = 'Low' | 'Medium' | 'High';

    type StockAIAnalysis = {
        available: boolean;
        symbol: string;
        name?: string;
        stance?: AIAnalysisStance;
        confidence?: AIAnalysisConfidence;
        thesis?: string;
        strengths?: string[];
        risks?: string[];
        technical?: string;
        valuation?: string;
        whatToWatch?: string[];
        generatedAt?: string;
        error?: string;
    };

    type CorporateEvent = {
        symbol: string;
        type: 'earnings' | 'ex_dividend';
        date: string;
    };

    type CorporateActionsResult = {
        events: CorporateEvent[];
        available?: boolean;
        error?: string;
    };

    type ScreenerStock = {
        symbol: string;
        name: string;
        sector: string | null;
        industry: string | null;
        price: number | null;
        changePercent: number | null;
        marketCap: number | null;
        trailingPE: number | null;
        forwardPE: number | null;
        priceToBook: number | null;
        pegRatio: number | null;
        roe: number | null;
        roa: number | null;
        profitMargin: number | null;
        operatingMargin: number | null;
        revenueGrowth: number | null;
        earningsGrowth: number | null;
        debtToEquity: number | null;
        dividendYield: number | null;
        beta: number | null;
    };

    type PeerComparison = {
        available: boolean;
        sector: string | null;
        base: string;
        rows: ScreenerStock[];
        summary?: string;
        error?: string;
    };

    type ScreenerFilter = {
        metric: keyof ScreenerStock | string;
        operator: '<' | '<=' | '>' | '>=';
        value: number;
    };

    type ScreenerCriteria = {
        filters: ScreenerFilter[];
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
        sectors?: string[];
    };

    type ScreenerResult = {
        available: boolean;
        query: string;
        interpreted?: string;
        criteria?: ScreenerCriteria;
        rows: ScreenerStock[];
        error?: string;
    };

    type OptionBuildup =
        | 'long_buildup'
        | 'short_buildup'
        | 'short_covering'
        | 'long_unwinding'
        | 'neutral';

    type OptionGreeks = {
        delta: number | null;
        gamma: number | null;
        theta: number | null;
        vega: number | null;
    };

    type OptionSide = {
        oi: number;
        changeOi: number;
        volume: number;
        iv: number | null;
        ltp: number | null;
        buildup?: OptionBuildup;
        greeks?: OptionGreeks;
    };

    type OptionStrike = {
        strike: number;
        ce: OptionSide;
        pe: OptionSide;
    };

    type OptionMaxPainPoint = { strike: number; loss: number };

    type OptionChainData = {
        symbol: string;
        type: string;
        underlying: number | null;
        expiry: string;
        expiries: string[];
        atmStrike: number | null;
        pcr: number | null;
        maxPain: number | null;
        daysToExpiry?: number;
        support?: number | null;
        resistance?: number | null;
        atmStraddle?: number | null;
        totalCeOi: number;
        totalPeOi: number;
        maxPainCurve?: OptionMaxPainPoint[];
        strikes: OptionStrike[];
        available?: boolean;
        error?: string;
    };

    type FearGreedComponent = {
        key: string;
        label: string;
        score: number;
        value: string;
        weight: number;
    };

    type FearGreedResult = {
        composite: number;
        label: string;
        components: FearGreedComponent[];
        nifty: number;
        vix: number | null;
        available?: boolean;
        error?: string;
    };

    type MarketRegimeConfig = { vixHigh: number; lookback: number };

    type MarketRegime = {
        regime: string;
        risk: 'risk-on' | 'risk-off' | 'neutral';
        note: string;
        nifty: {
            price: number;
            changePercent: number;
            vsSma50Pct: number;
            vsSma200Pct: number;
            slopePctPerDay: number;
        };
        vix: number | null;
        vixHigh: number;
        annualizedVolPct: number;
        breadthPct: number;
        advancers: number;
        decliners: number;
        universe: number;
        available?: boolean;
        error?: string;
    };

    type ScorecardFactor = { label: string; value: string; note?: string };

    type ScorecardAxis = {
        key: string;
        label: string;
        score: number | null;     // 0-100, null when data unavailable
        weight: number;           // default weight (0-1)
        summary: string;
        factors: ScorecardFactor[];
    };

    type StockScorecard = {
        symbol: string;
        available: boolean;
        composite: number;        // 0-100 default (equal-weight) composite
        grade: string;            // A+ … D
        axes: ScorecardAxis[];
        error?: string;
    };

    type ComparisonAxis = { key: string; label: string; score: number | null };

    type ComparisonMetrics = {
        price: number | null;
        marketCap: number | null;
        trailingPE: number | null;
        priceToBook: number | null;
        roe: number | null;
        profitMargin: number | null;
        debtToEquity: number | null;
        revenueGrowth: number | null;
        beta: number | null;
        dividendYield: number | null;
    };

    type ComparisonStock = {
        symbol: string;
        name: string;
        available: boolean;
        grade: string;
        composite: number;
        axes: ComparisonAxis[];
        metrics: ComparisonMetrics;
    };

    type ForecastScenario = { price: number; returnPct: number };

    type ForecastDriftMode = 'balanced' | 'neutral' | 'momentum';

    type ForecastConfig = {
        horizon: number;
        lookback: number;
        paths: number;
        ci: number;
        driftMode: ForecastDriftMode;
    };

    type ForecastResult = {
        symbol: string;
        lastClose: number;
        horizonDays: number;
        ci: number;
        lookback: number;
        paths: number;
        driftMode: ForecastDriftMode;
        history: number[];
        median: number[];
        upper: number[];
        lower: number[];
        samplePaths: number[][];
        probProfitPct: number;
        expectedReturnPct: number;
        downside5Pct: number;
        annualizedVolPct: number;
        scenarios: { bull: ForecastScenario; base: ForecastScenario; bear: ForecastScenario };
        available?: boolean;
        error?: string;
    };

    type BacktestStrategy = 'sma_cross' | 'rsi' | 'breakout';

    type BacktestMetrics = {
        totalReturnPct: number;
        buyHoldReturnPct: number;
        cagrPct: number;
        maxDrawdownPct: number;
        sharpe: number;
        sortino: number;
        calmar: number;
        profitFactor: number;
        winRatePct: number;
        trades: number;
        avgWinPct: number;
        avgLossPct: number;
        bestTradePct: number;
        worstTradePct: number;
        avgHoldBars: number;
        maxConsecLosses: number;
        exposurePct: number;
        startCapital: number;
        finalCapital: number;
        pnl: number;
    };

    type BacktestTrade = {
        entryDate: string;
        exitDate: string;
        entryPrice: number;
        exitPrice: number;
        returnPct: number;
        pnl: number;
        bars: number;
        exit: string;
    };

    type BacktestEquityPoint = { time: string; strategy: number; buyHold: number };

    type BacktestResult = {
        symbol: string;
        strategy: BacktestStrategy;
        range: string;
        params: Record<string, number>;
        bars: number;
        startDate: string;
        endDate: string;
        metrics: BacktestMetrics;
        equityCurve: BacktestEquityPoint[];
        trades: BacktestTrade[];
        available?: boolean;
        error?: string;
    };

    type TechnicalSignalState = 'bull' | 'bear' | 'neutral';

    type TechnicalCategory = 'Trend' | 'Momentum' | 'Volatility' | 'Volume';

    type TechnicalIndicator = {
        label: string;
        value: string;
        signal: TechnicalSignalState;
        note: string;
        category?: TechnicalCategory;
    };

    type TechnicalConfig = {
        rsiPeriod: number;
        smaFast: number;
        smaMid: number;
        smaLong: number;
        bbPeriod: number;
        bbStd: number;
        adxPeriod: number;
        atrPeriod: number;
    };

    type TechnicalTimeframeRSI = {
        timeframe: 'Daily' | 'Weekly' | 'Monthly';
        rsi: number | null;
        signal: TechnicalSignalState;
    };

    type TechnicalBands = {
        price: number;
        upper: number;
        mid: number;
        lower: number;
        percentB: number;
        widthPct: number;
    };

    type PriceForecast = {
        horizonDays: number;
        lastClose: number;
        history: number[];      // recent closes (tail) for context
        median: number[];       // projected expected path
        upper: number[];        // upper confidence band
        lower: number[];        // lower confidence band
        expectedReturnPct: number;
        annualizedVolPct: number;
        confidence: 'Low' | 'Medium' | 'High';
    };

    type TechnicalSignals = {
        available: boolean;
        symbol: string;
        price: number;
        score: number;          // 0-100 composite
        bias: 'Bullish' | 'Bearish' | 'Neutral';
        regime: string;
        regimeNote: string;
        indicators: TechnicalIndicator[];
        multiTimeframe?: TechnicalTimeframeRSI[];
        bands?: TechnicalBands;
        config?: TechnicalConfig;
        forecast?: PriceForecast;
        error?: string;
    };

    type MarketScanRow = {
        symbol: string;
        price: number;
        changePercent: number;
        score: number;
        bias: 'Bullish' | 'Bearish' | 'Neutral';
        regime: string;
        rsi: number | null;
        aboveSma50: boolean | null;
        aboveSma200: boolean | null;
    };

    type MarketScanResult = {
        available: boolean;
        sector: string;
        rows: MarketScanRow[];
        error?: string;
    };

    type SignInFormData = {
        email: string;
        password: string;
    };

    type SignUpFormData = {
        fullName: string;
        email: string;
        password: string;
        country: string;
        investmentGoals: string;
        riskTolerance: string;
        preferredIndustry: string;
    };

    type CountrySelectProps = {
        name: string;
        label: string;
        control: Control;
        error?: FieldError;
        required?: boolean;
    };

    type FormInputProps = {
        name: string;
        label: string;
        placeholder: string;
        type?: string;
        register: UseFormRegister;
        error?: FieldError;
        validation?: RegisterOptions;
        disabled?: boolean;
        value?: string;
    };

    type Option = {
        value: string;
        label: string;
    };

    type SelectFieldProps = {
        name: string;
        label: string;
        placeholder: string;
        options: readonly Option[];
        control: Control;
        error?: FieldError;
        required?: boolean;
    };

    type FooterLinkProps = {
        text: string;
        linkText: string;
        href: string;
    };

    type SearchCommandProps = {
        renderAs?: 'button' | 'text' | 'box';
        label?: string;
        initialStocks: StockWithWatchlistStatus[];
    };

    type WelcomeEmailData = {
        email: string;
        name: string;
        intro: string;
    };

    type User = {
        id: string;
        name: string;
        email: string;
    };

    type Stock = {
        symbol: string;
        name: string;
        exchange: string;
        type: string;
    };

    type StockWithWatchlistStatus = Stock & {
        isInWatchlist: boolean;
    };

    type FinnhubSearchResult = {
        symbol: string;
        description: string;
        displaySymbol?: string;
        type: string;
    };

    type FinnhubSearchResponse = {
        count: number;
        result: FinnhubSearchResult[];
    };

    type StockDetailsPageProps = {
        params: Promise<{
            symbol: string;
        }>;
    };

    type WatchlistButtonProps = {
        symbol: string;
        company: string;
        isInWatchlist: boolean;
        showTrashIcon?: boolean;
        type?: 'button' | 'icon';
        onWatchlistChange?: (symbol: string, isAdded: boolean) => void;
    };

    type QuoteData = {
        c?: number;
        dp?: number;
    };

    type ProfileData = {
        name?: string;
        marketCapitalization?: number;
    };

    type FinancialsData = {
        metric?: { [key: string]: number };
    };

    type SelectedStock = {
        symbol: string;
        company: string;
        currentPrice?: number;
    };

    type WatchlistTableProps = {
        watchlist: StockWithData[];
    };

    type StockWithData = {
        userId: string;
        symbol: string;
        company: string;
        addedAt: Date;
        currentPrice?: number;
        changePercent?: number;
        priceFormatted?: string;
        changeFormatted?: string;
        marketCap?: string;
        peRatio?: string;
    };

    type AlertsListProps = {
        alertData: Alert[] | undefined;
    };

    type MarketNewsArticle = {
        id: number;
        headline: string;
        summary: string;
        source: string;
        url: string;
        datetime: number;
        category: string;
        related: string;
        image?: string;
    };

    type WatchlistNewsProps = {
        news?: MarketNewsArticle[];
    };

    type MarketNewsItem = {
        id: string;
        headline: string;
        summary: string;
        source: string | null;
        url: string;
        image: string | null;
        datetime: number;
    };

    type MarketCalendarEvent = {
        id: string;
        title: string;
        country: string;
        currency: string;
        importance: number;
        actual: number | string | null;
        forecast: number | string | null;
        previous: number | string | null;
        unit: string;
        period: string;
        category: string;
        comment: string;
        source: string;
        sourceUrl: string;
        datetime: number;
    };

    type SearchCommandProps = {
        open?: boolean;
        setOpen?: (open: boolean) => void;
        renderAs?: 'button' | 'text' | 'box';
        buttonLabel?: string;
        buttonVariant?: 'primary' | 'secondary';
        className?: string;
    };

    type AlertData = {
        symbol: string;
        company: string;
        alertName: string;
        alertType: 'upper' | 'lower';
        threshold: string;
    };

    type AlertModalProps = {
        alertId?: string;
        alertData?: AlertData;
        action?: string;
        open: boolean;
        setOpen: (open: boolean) => void;
    };

    type RawNewsArticle = {
        id: number;
        headline?: string;
        summary?: string;
        source?: string;
        url?: string;
        datetime?: number;
        image?: string;
        category?: string;
        related?: string;
    };

    type Alert = {
        id: string;
        symbol: string;
        company: string;
        alertName: string;
        currentPrice: number;
        alertType: 'upper' | 'lower';
        threshold: number;
        changePercent?: number;
    };
}

export {};