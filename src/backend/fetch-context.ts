import { HTTPException } from "hono/http-exception"

const TIME_LIMIT = 5 * 1000 // 5 seconds

export class FetchContext {
    startedAt = performance.now()

    breakIfNeeded(refreshAfter = 1) {
        const sanitizedRefreshAfter = Math.floor(Number.isNaN(refreshAfter) ? 1 : refreshAfter)
        const clampedRefreshAfter = Math.min(Math.max(sanitizedRefreshAfter))
        const diff = performance.now() - this.startedAt + clampedRefreshAfter * 1000
        if (diff > TIME_LIMIT) {
            const res = new Response(
                `<meta charset="UTF-8"><meta http-equiv="Refresh" content="${clampedRefreshAfter}">取得中です……しばらくお待ちください`,
                {
                    status: 503,
                    headers: {
                        "Content-Type": "text/html; charset=UTF-8",
                    },
                },
            )
            throw new HTTPException(503, {
                res,
            })
        }
    }
}
