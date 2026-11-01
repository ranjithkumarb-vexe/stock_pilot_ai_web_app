import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTheme } from '@/theme/ThemeProvider';
import { chartColors, type CBar } from './chartData';

type Props = { symbol: string; bars: CBar[]; onFail: (failed: boolean) => void };

const cd = (b: CBar) => ({
  time: b.time as UTCTimestamp,
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
});

/**
 * lightweight-charts@4.2.0: candles + volume histogram. The first render (or a symbol change) sets the data, later
 * renders only `update()` the last candle, so SSE ticks are cheap. If the library cannot start (no canvas, blocked
 * script) `onFail(true)` lets the screen fall back to the data table.
 */
type Api = { chart: IChartApi; candles: ISeriesApi<'Candlestick'>; volume: ISeriesApi<'Histogram'> };

export function LiveChart({ symbol, bars, onFail }: Props) {
  const prev = useRef<{ symbol: string; len: number; first: number } | null>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const [api, setApi] = useState<Api | null>(null);
  const apiRef = useRef<Api | null>(null);
  const colors = chartColors(theme);

  // callback ref: create the chart when the host mounts, dispose when it unmounts
  const host = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        try {
          apiRef.current?.chart.remove();
        } catch {
          /* already disposed */
        }
        apiRef.current = null;
        prev.current = null;
        setApi(null);
        return;
      }
      try {
        const c = chartColors(themeRef.current);
        const chart = createChart(node, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: c.bg },
            textColor: c.text,
            fontFamily: 'Geist Mono, monospace',
            fontSize: 11,
          },
          grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
          rightPriceScale: { borderColor: c.grid },
          timeScale: { borderColor: c.grid, timeVisible: true, secondsVisible: false, rightOffset: 4 },
          crosshair: { mode: 1 },
        });
        const candles = chart.addCandlestickSeries({
          upColor: c.up,
          downColor: c.down,
          borderUpColor: c.up,
          borderDownColor: c.down,
          wickUpColor: c.up,
          wickDownColor: c.down,
        });
        const volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
        chart.priceScale('').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        apiRef.current = { chart, candles, volume };
        setApi(apiRef.current);
      } catch {
        onFail(true);
      }
    },
    [onFail],
  );

  // theme
  useEffect(() => {
    themeRef.current = theme;
    if (!api) return;
    const c = chartColors(theme);
    api.chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.grid },
      timeScale: { borderColor: c.grid },
    });
    api.candles.applyOptions({
      upColor: c.up,
      downColor: c.down,
      borderUpColor: c.up,
      borderDownColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
    });
    prev.current = null; // volume colours depend on the theme: reset the series data
  }, [api, theme]);

  // data: full set on first render / symbol change, then only update() the last candle
  useEffect(() => {
    if (!api) return;
    const c = colors;
    const vol = (b: CBar) => ({
      time: b.time as UTCTimestamp,
      value: b.volume,
      color: `${b.close >= b.open ? c.up : c.down}55`,
    });
    const last = bars[bars.length - 1];
    const p = prev.current;
    try {
      const same =
        p &&
        p.symbol === symbol &&
        p.first === (bars[0]?.time ?? 0) &&
        bars.length >= p.len &&
        bars.length - p.len <= 1;
      if (!same) {
        api.candles.setData(bars.map(cd));
        api.volume.setData(bars.map(vol));
        api.chart.timeScale().fitContent();
      } else if (last) {
        api.candles.update(cd(last));
        api.volume.update(vol(last));
      }
      prev.current = { symbol, len: bars.length, first: bars[0]?.time ?? 0 };
    } catch {
      /* a malformed bar must not take the screen down; the data table still shows the rows */
    }
    // colours only matter when the data is (re)written
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, bars, symbol]);

  return <div ref={host} data-testid="live-chart" style={{ position: 'absolute', inset: 0 }} />;
}
