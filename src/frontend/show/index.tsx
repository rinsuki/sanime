import React, { useState } from "react"
import { createRoot } from "react-dom/client"

import {
    calcStatusScore,
    isNearCurrentOrAfterSeason,
    malIdIfPossible,
    READABLE_SEASON,
    Season,
    SEASONS,
    statusScore,
    WatchStatus,
} from "../../type.js"

import "./style.css"
import { AnimeTypeIcon } from "./components/anime-type-icon.js"
import { AnimeComponent } from "./components/anime.js"
import { CheckButton } from "./components/check-button.js"
import { animes, users, warns } from "./initial-data.js"
import { AnimeUserStatus, FilterMode, filterModeName, filterModes } from "./type.js"

const animeToUsers = new Map<ReturnType<typeof malIdIfPossible>, AnimeUserStatus[]>()

for (const user of users) {
    for (const work of user.works) {
        const workId = malIdIfPossible(work)
        const workObj = animes[workId]
        let arr = animeToUsers.get(workId)
        if (arr == null) {
            arr = []
            animeToUsers.set(workId, arr)
        }
        const already = arr.find(x => x.user === user.id)
        // Annict → MAL の名寄せではたまに MAL がないものがある
        if (already != null) {
            if (
                statusScore(already.status, workObj.season) >=
                statusScore(work.status, workObj.season)
            ) {
                already.status = work.status
            }
            continue
        }
        arr.push({
            user: user.id,
            status: work.status,
        })
    }
}
const keys = Array.from(animeToUsers.keys()).sort(
    (a, b) =>
        calcStatusScore(animeToUsers.get(b)!, animes[b].season) -
        calcStatusScore(animeToUsers.get(a)!, animes[a].season),
)
console.log({ keys })
const animeProps = keys.map(key => ({ key, anime: animes[key], statuses: animeToUsers.get(key)! }))
console.log({ animeProps })

function App() {
    const [filterUser, setFilterUser] = useState<string>()
    const [filterMode, setFilterMode] = useState<FilterMode>("NOT_WATCHED")
    const [hideOnlyWant, setHideOnlyWant] = useState(true)
    const [showOnlyNotInMAL, setShowOnlyNotInMAL] = useState(false)
    const [showOnlyNotInAniList, setShowOnlyNotInAniList] = useState(false)
    const [showOnlyNotInAnnict, setShowOnlyNotInAnnict] = useState(false)
    const [seasonFilter, setSeasonFilter] = useState("ALL")
    const [seasonFilterYear, setSeasonFilterYear] = useState(() => new Date().getFullYear())
    const [seasonFilterName, setSeasonFilterName] = useState<Season>()
    const [showTVAnime, setShowTVAnime] = useState(true)
    const [showMovie, setShowMovie] = useState(true)
    const [showOVA, setShowOVA] = useState(true)
    const [showONA, setShowONA] = useState(true)
    const [showOthers, setShowOthers] = useState(true)
    const [minViewersCount, setMinViewersCount] = useState(1)
    return (
        <div>
            <p>
                <select
                    onChange={e => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        setFilterUser(JSON.parse(e.currentTarget.value))
                    }}
                >
                    <option value={"null"}>未指定</option>
                    {...users.map(({ id: user }) => {
                        return (
                            <option key={user} value={JSON.stringify(user)}>
                                {user}
                            </option>
                        )
                    })}
                </select>
                が
                <select onChange={e => setFilterMode(e.currentTarget.value as FilterMode)}>
                    {...filterModes.map(fm => (
                        <option key={fm} value={fm}>
                            {filterModeName[fm]}
                        </option>
                    ))}
                </select>
                アニメを表示
            </p>
            <p>
                <label>
                    <input
                        type="checkbox"
                        checked={hideOnlyWant}
                        onChange={e => setHideOnlyWant(e.currentTarget.checked)}
                    />
                    「見たい」しか付けている人がいないアニメは非表示
                </label>
            </p>
            <p>
                <label>
                    <input
                        type="checkbox"
                        checked={showOnlyNotInMAL}
                        onChange={e => setShowOnlyNotInMAL(e.currentTarget.checked)}
                    />
                    MALとの紐付けが登録されていないアニメのみ表示する
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showOnlyNotInAniList}
                        onChange={e => setShowOnlyNotInAniList(e.currentTarget.checked)}
                    />
                    AniListとの紐付けが登録されていないアニメのみ表示する
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showOnlyNotInAnnict}
                        onChange={e => setShowOnlyNotInAnnict(e.currentTarget.checked)}
                    />
                    Annictとの紐付けが登録されていないアニメのみ表示する
                    (AniListのユーザーしか見ていないアニメも表示されます)
                </label>
            </p>
            <p>
                <label>
                    <input
                        type="number"
                        min="0"
                        value={minViewersCount}
                        onChange={e =>
                            setMinViewersCount(
                                Math.max(0, parseInt(e.currentTarget.value, 10) || 0),
                            )
                        }
                        style={{ width: "4em" }}
                    />
                    人以上が見た/見ているアニメのみ表示する
                </label>
            </p>
            <p
                onChange={e =>
                    e.target instanceof HTMLInputElement &&
                    e.target.type === "radio" &&
                    setSeasonFilter(e.target.value)
                }
            >
                シーズンフィルタ:
                <label>
                    <input type="radio" name="seasonFilter" value="ALL" defaultChecked />
                    フィルタなし
                </label>
                <label>
                    <input type="radio" name="seasonFilter" value="CURRENT" />
                    だいたい今期のアニメのみを表示する
                </label>
                <label>
                    <input type="radio" name="seasonFilter" value="SPECIFIC" />
                    特定のシーズンのアニメのみを表示する:
                    <input
                        type="number"
                        value={seasonFilterYear}
                        onChange={e => setSeasonFilterYear(+e.currentTarget.value)}
                        size={6}
                        disabled={seasonFilter !== "SPECIFIC"}
                    />
                    年
                    <select
                        onChange={e =>
                            setSeasonFilterName(
                                SEASONS.includes(e.currentTarget.value as Season)
                                    ? (e.currentTarget.value as Season)
                                    : undefined,
                            )
                        }
                        disabled={seasonFilter !== "SPECIFIC"}
                    >
                        <option>全期</option>
                        {...SEASONS.map(season => (
                            <option value={season} key={season}>
                                {READABLE_SEASON[season]}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <input type="radio" name="seasonFilter" value="NODATA" />
                    シーズンデータがないアニメのみを表示する
                </label>
            </p>
            <p>
                <CheckButton
                    checked={showTVAnime}
                    onChange={e => setShowTVAnime(e.currentTarget.checked)}
                >
                    <AnimeTypeIcon type="TV" />
                    TV
                </CheckButton>
                <CheckButton
                    checked={showMovie}
                    onChange={e => setShowMovie(e.currentTarget.checked)}
                >
                    <AnimeTypeIcon type="MOVIE" />
                    映画
                </CheckButton>
                <CheckButton checked={showOVA} onChange={e => setShowOVA(e.currentTarget.checked)}>
                    <AnimeTypeIcon type="OVA" />
                    OVA
                </CheckButton>
                <CheckButton checked={showONA} onChange={e => setShowONA(e.currentTarget.checked)}>
                    <AnimeTypeIcon type="ONA" />
                    ONA
                </CheckButton>
                <CheckButton
                    checked={showOthers}
                    onChange={e => setShowOthers(e.currentTarget.checked)}
                >
                    <AnimeTypeIcon type="OTHERS" />
                    その他
                </CheckButton>
            </p>
            <div className="anime-list">
                {animeProps.map(({ key, anime, statuses }) => {
                    if (showOnlyNotInAniList && anime.idAniList != null) return null
                    if (showOnlyNotInMAL && anime.idMal != null) return null
                    if (showOnlyNotInAnnict && anime.idAnnict != null) return null
                    if (seasonFilter === "CURRENT") {
                        if (anime.season == null || !isNearCurrentOrAfterSeason(anime.season))
                            return null
                    } else if (seasonFilter === "SPECIFIC") {
                        if (
                            anime.season == null ||
                            anime.season.year !== seasonFilterYear ||
                            (seasonFilterName != null && anime.season.name !== seasonFilterName)
                        )
                            return null
                    } else if (seasonFilter === "NODATA") {
                        if (anime.season != null) return null
                    }
                    if (!showTVAnime && anime.type === "TV") return null
                    if (!showMovie && anime.type === "MOVIE") return null
                    if (!showOVA && anime.type === "OVA") return null
                    if (!showONA && anime.type === "ONA") return null
                    if (!showOthers && anime.type === "OTHERS") return null
                    const status = new Map<WatchStatus, string[]>()
                    let filterUserSeen = false
                    let onlyWant = hideOnlyWant
                    const knownUsers = new Set()
                    for (const s of statuses) {
                        if (s.user === filterUser) {
                            filterUserSeen = true
                            if (filterMode === "NOT_KNOW") {
                                return null
                            } else if (filterMode === "NOT_SEEN" || filterMode === "WANT") {
                                if (s.status !== "WANT") return null
                            } else if (filterMode === "NOT_WATCHED") {
                                if (s.status === "WATCHED" || s.status === "REPEATING") return null
                            } else if (filterMode === "ONLY_WATCHED") {
                                if (s.status !== "WATCHED" && s.status !== "REPEATING") return null
                            } else if (filterMode === "CHOTTO_WATCHED") {
                                if (
                                    s.status !== "WATCHED" &&
                                    s.status !== "REPEATING" &&
                                    s.status !== "DROPPED" &&
                                    s.status !== "PAUSED" &&
                                    s.status !== "WATCHING"
                                )
                                    return null
                            }
                        }
                        let arr = status.get(s.status)
                        if (arr == null) {
                            arr = []
                            status.set(s.status, arr)
                        }
                        if (s.status !== "WANT") onlyWant = false
                        arr.push(s.user)
                        knownUsers.add(s.user)
                    }
                    if (
                        !filterUserSeen &&
                        (filterMode === "ONLY_WATCHED" ||
                            filterMode === "CHOTTO_WATCHED" ||
                            filterMode === "KNOW" ||
                            filterMode === "WANT")
                    )
                        return null
                    if (onlyWant) return null
                    if (minViewersCount > 0) {
                        const viewersCount = Array.from(status.entries()).reduce(
                            (count, [s, users]) =>
                                s === "WATCHED" || s === "WATCHING" || s === "REPEATING"
                                    ? count + users.length
                                    : count,
                            0,
                        )
                        if (viewersCount < minViewersCount) return null
                    }
                    const unknownUsers = users.map(u => u.id).filter(u => !knownUsers.has(u))
                    return (
                        <AnimeComponent
                            key={key}
                            anime={anime}
                            status={status}
                            unknownUsers={unknownUsers}
                        />
                    )
                })}
            </div>
            {warns.length > 0 && (
                <div>
                    <h2>Warning</h2>
                    <pre>{warns.join("\n")}</pre>
                </div>
            )}
        </div>
    )
}

createRoot(document.getElementById("app")!).render(<App />)
