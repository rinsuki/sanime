import { dirname } from "node:path"

import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AnimeInfo, malIdIfPossible, ServiceID } from "../type.js"
import { isNotNull } from "../utils/is-not-null.js"

import { FetchContext } from "./fetch-context.js"
import { fetchAniListAnimes } from "./fetchers/animes/anilist.js"
import { fetchAnnictAnimes } from "./fetchers/animes/annict.js"
import { fetchMyAnimeListAnimes } from "./fetchers/animes/myanimelist.js"
import { fetchAniListWatches } from "./fetchers/watchlists/anilist.js"
import { fetchAnnictWatches } from "./fetchers/watchlists/annict.js"
import { fetchMyAnimeListWatches } from "./fetchers/watchlists/myanimelist.js"
import { ViewsShow } from "./views/show.js"
import { ViewsTop } from "./views/top.js"

const PUBLIC_DIR = dirname(new URL(import.meta.url).pathname) + "/../../public"

const app = new Hono()

app.get("/", c => c.html("<!DOCTYPE html>\n" + renderToStaticMarkup(createElement(ViewsTop))))

app.get("/wp-login.php", c => c.text("I'm a teapot, not WordPress :P", 418))

app.get("/wp-admin/*", c => c.text("I'm a teapot, not WordPress :P", 418))

app.get("/show", async c => {
    const fetchContext = new FetchContext()
    let userIds: string[] = (c.req.query("users") ?? "")
        .split(",")
        .map((u: string) => u.trim())
        .filter((u: string) => u.length > 0)
    if (userIds.length === 0) return c.redirect("/")
    userIds = userIds.filter((id, i, arr) => arr.indexOf(id) === i)
    for (const userId of userIds) {
        if (!/^(?:annict|anilist|mal):[A-Za-z0-9_-]{1,50}$/.test(userId)) {
            return c.text("?users query including invalid user ID", 422)
        }
    }
    if (userIds.length > 20) {
        return c.text("for now, maximum number of users is 20", 422)
    }
    const annictUsernames = userIds
        .filter(u => u.startsWith("annict:"))
        .map(a => a.slice("annict:".length))
    const anilistUsernames = userIds
        .filter(u => u.startsWith("anilist:"))
        .map(a => a.slice("anilist:".length))
    const malUsernames = userIds.filter(u => u.startsWith("mal:")).map(a => a.slice("mal:".length))
    const users = (
        await Promise.all([
            fetchAnnictWatches(annictUsernames),
            fetchAniListWatches(anilistUsernames),
            fetchMyAnimeListWatches(malUsernames),
        ])
    ).flat(1)

    const allWorks = users.map(u => u.works).flat(1)
    const needsToFetch = new Set(allWorks.map(w => malIdIfPossible(w)))
    const worksMap = new Map<ServiceID, AnimeInfo>()
    const warns: string[] = []
    // We have a Annict & MAL & AniList Data, and we need to merge them
    // First, extract ALL MAL IDs Animes, and fetch it from AniList
    console.log("anilist check...")
    const malWorkIds = allWorks.map(w => w.myAnimeListID).filter(isNotNull)
    const anilistMALWorks = await fetchAniListAnimes(
        fetchContext,
        Array.from(new Set(malWorkIds)),
        true,
    )
    const anilistTitles = new Map<ServiceID, string>()
    for (const work of anilistMALWorks) {
        if (worksMap.has(work.id)) {
            warns.push(`Duplicate AniList ID ${work.id}`)
        } else if (work.title != null) {
            anilistTitles.set(work.id, work.title)
        }
        worksMap.set(work.id, work)
        needsToFetch.delete(work.id)
    }
    // Then, Fetch some AniList Only things
    console.log("anilist only check...")
    const anilistIds = allWorks
        .map(w => (w.myAnimeListID != null ? null : w.sourceServiceID))
        .filter(isNotNull)
        .filter(i => i.startsWith("anilist:"))
        .map(a => parseInt(a.slice("anilist:".length), 10))
    const anilistWorks = await fetchAniListAnimes(fetchContext, anilistIds, false)
    for (const work of anilistWorks) {
        if (worksMap.has(work.id)) {
            warns.push(`Duplicate AniList ID ${work.id}`)
        } else if (work.title != null) {
            anilistTitles.set(work.id, work.title)
        }
        worksMap.set(work.id, work)
        needsToFetch.delete(work.id)
    }
    // Then, Fetch All Annict IDs
    console.log("annict check...")
    const annictWorkIds = Array.from(
        new Set(
            allWorks
                .filter(w => w.sourceServiceID.startsWith("annict:"))
                .map(w => parseInt(w.sourceServiceID.slice("annict:".length), 10)),
        ),
    )
    const annictWorks = await fetchAnnictAnimes(annictWorkIds)
    for (const work of annictWorks) {
        const oldWork = worksMap.get(work.id)
        if (oldWork != null) {
            if (oldWork.idAnnict != null && work.idAnnict != null) {
                warns.push(
                    `Annict ID collision! ${work.id} old: ${oldWork.idAnnict}, new: ${work.idAnnict}`,
                )
                const anilistTitle = anilistTitles.get(work.id)
                if (anilistTitle != null) {
                    work.title = anilistTitle
                    warns.push("Use AniList title: " + anilistTitle)
                } else {
                    warns.push("Want to use AniList title, but it isn't available...")
                }
            } else {
                if (work.season != null) oldWork.season = work.season
            }
            oldWork.idAnnict ??= work.idAnnict
            if (work.title != null) oldWork.title = work.title
            oldWork.horizontalCoverURL ??= work.horizontalCoverURL
            if (work.type != null) oldWork.type = work.type
        } else {
            worksMap.set(work.id, work)
        }
        needsToFetch.delete(work.id)
    }
    // Then, Fetch Remain MAL IDs from MAL
    const existsKeys = new Set(worksMap.keys())
    const remainedMALIds = Array.from(needsToFetch).filter(
        x => x.startsWith("mal:") && !existsKeys.has(x),
    )

    const malWorks = await fetchMyAnimeListAnimes(
        remainedMALIds.map(x => parseInt(x.slice("mal:".length), 10)),
    )
    for (const work of malWorks) {
        worksMap.set(work.id, work)
        needsToFetch.delete(work.id)
    }

    if (needsToFetch.size > 0) {
        console.error(needsToFetch)
        let canFixByReload = false
        const needsToFetchIDs = Array.from(needsToFetch).join("\n")
        const annictIds: number[] = []
        for (const id of needsToFetch) {
            if (id.startsWith("mal:")) {
                const mal2Annict = new Map()
                for (const work of allWorks) {
                    if (work.myAnimeListID == null) continue
                    if (!work.sourceServiceID.startsWith("annict:")) continue
                    const annictId = parseInt(work.sourceServiceID.slice("annict:".length), 10)
                    if (needsToFetch.has(malIdIfPossible(work))) {
                        annictIds.push(annictId)
                    }
                }
            }
        }
        if (annictIds.length) {
            canFixByReload = true
            await fetchAnnictAnimes(annictIds, true)
        }
        let body = "Internal Server Error\n\nFailed to fetch some animes info"
        if (canFixByReload) body += " (please try reload)"
        body += `\n${needsToFetchIDs}`
        return c.text(body, 500)
    }

    return c.html(
        "<!DOCTYPE html>\n" +
            renderToStaticMarkup(
                createElement(ViewsShow, {
                    users,
                    animes: Object.fromEntries(worksMap.entries()),
                    warns,
                }),
            ),
    )
})

app.use(
    "/:path{.*\\.[a-z]{1,10}}",
    serveStatic({
        root: PUBLIC_DIR,
    }),
)

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    info => {
        console.log(`Listen on http://${info.address}:${info.port}`)
    },
)
