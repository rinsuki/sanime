import { HTTPException } from "hono/http-exception"

const TIME_LIMIT = 5 * 1000 // 5 seconds

export class FetchContext {
    startedAt = performance.now()

    breakIfNeeded() {
        const diff = performance.now() - this.startedAt
        if (diff > TIME_LIMIT) {
            const res = new Response(
                '<meta charset="UTF-8"><meta http-equiv="Refresh" content="1">取得中です……',
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
