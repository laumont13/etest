"""
E-Test · Google Trends (pytrends)
------------------------------------------------------------------------------
Función serverless de Vercel (runtime Python). Recibe ?q=<query>&geo=<CC> y
devuelve el interés promedio (0-100) y la dirección de la tendencia.

pytrends es frágil: Google puede responder 429 o vacío. En ese caso devolvemos
interest=null en vez de inventar un número. La capa de análisis lo marca como
dato faltante.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json


def _trend(query: str, geo: str):
    """Devuelve (interest:int|None, direction:str). No lanza: ante error, nulls."""
    try:
        from pytrends.request import TrendReq
    except Exception:
        return None, "unknown"

    try:
        py = TrendReq(hl="es", tz=180, timeout=(4, 8))
        py.build_payload([query], timeframe="today 12-m", geo=geo or "")
        df = py.interest_over_time()
        if df is None or df.empty or query not in df.columns:
            return None, "unknown"

        series = df[query].tolist()
        if not series:
            return None, "unknown"

        avg = round(sum(series) / len(series))

        # Dirección: comparar promedio del último tercio vs el primer tercio.
        third = max(1, len(series) // 3)
        first = sum(series[:third]) / third
        last = sum(series[-third:]) / third
        if last > first * 1.15:
            direction = "rising"
        elif last < first * 0.85:
            direction = "declining"
        else:
            direction = "stable"

        return avg, direction
    except Exception:
        return None, "unknown"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        query = (params.get("q", [""])[0] or "").strip()
        geo = (params.get("geo", [""])[0] or "").strip()

        if not query:
            self._send(400, {"error": "missing query param q"})
            return

        interest, direction = _trend(query, geo)
        self._send(
            200,
            {
                "query": query,
                "geo": geo,
                "interest": interest,        # int 0-100 o null
                "direction": direction,       # rising|stable|declining|unknown
                "available": interest is not None,
            },
        )

    def _send(self, code: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "s-maxage=3600")
        self.end_headers()
        self.wfile.write(payload)
