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

    type OptionSide = {
        oi: number;
        changeOi: number;
        volume: number;
        iv: number | null;
        ltp: number | null;
    };

    type OptionStrike = {
        strike: number;
        ce: OptionSide;
        pe: OptionSide;
    };

    type OptionChainData = {
        symbol: string;
        type: string;
        underlying: number | null;
        expiry: string;
        expiries: string[];
        atmStrike: number | null;
        pcr: number | null;
        maxPain: number | null;
        totalCeOi: number;
        totalPeOi: number;
        strikes: OptionStrike[];
        available?: boolean;
        error?: string;
    };

    type TechnicalSignalState = 'bull' | 'bear' | 'neutral';

    type TechnicalIndicator = {
        label: string;
        value: string;
        signal: TechnicalSignalState;
        note: string;
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