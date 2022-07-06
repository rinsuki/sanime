import React, { useState } from "react"
import { createRoot } from "react-dom/client"

const userValidator = /^[a-zA-Z0-9_]+$/

const AddUserForm: React.FC<{ add: (user: string) => void }> = ({ add }) => {
    const [service, setService] = useState("annict")
    const [user, setUser] = useState("")

    const urlHandler = (url: string) => {
        const annictUserURL = /^https:\/\/annict.com\/@(?<user>[A-Za-z0-9_]+)(?:\/|$)/.exec(url)
        if (annictUserURL != null) {
            const user = annictUserURL.groups?.user
            if (user != null) add(`annict:${user.toLowerCase()}`)
            return true
        }
        const anilistUserURL = /^https:\/\/anilist.com\/user\/(?<user>[A-Za-z0-9_]+)(?:\/|$)/.exec(
            url,
        )
        if (anilistUserURL != null) {
            const user = anilistUserURL.groups?.user
            if (user != null) add(`anilist:${user.toLowerCase()}`)
            return true
        }

        return false
    }

    return (
        <form
            onSubmit={e => {
                e.preventDefault()
                if (user.length) {
                    add(`${service}:${user.toLowerCase()}`)
                    setUser("")
                }
            }}
            onDrop={e => {
                if (e.dataTransfer == null) return
                const text = e.dataTransfer.getData("text/plain")
                if (text == null) return
                if (urlHandler(text)) {
                    e.preventDefault()
                    return
                }
            }}
        >
            <select value={service} onChange={e => setService(e.target.value)}>
                <option value="annict">Annict</option>
                <option value="anilist">AniList</option>
            </select>
            <input
                type="text"
                placeholder="username"
                value={user}
                onChange={e => setUser(e.target.value)}
                onPaste={e => {
                    const text = e.clipboardData.getData("text")
                    if (!text.length) return
                    if (urlHandler(text)) e.preventDefault()
                }}
            />
            <input type="submit" value="追加" disabled={!user.length} />
        </form>
    )
}

const App: React.FC = () => {
    const [users, setUsers] = useState<string[]>([])
    const [currentUser, setCurrentUser] = useState("")
    return (
        <div>
            <AddUserForm
                add={user =>
                    setUsers(users => {
                        if (users.includes(user)) return users
                        return [...users, user]
                    })
                }
            />
            <ul>
                {...users.map(user => (
                    <li key={user}>
                        <button
                            onClick={() => {
                                setUsers(users => users.filter(u => u !== user))
                            }}
                        >
                            削除
                        </button>{" "}
                        {user}
                    </li>
                ))}
            </ul>
            <button
                onClick={() => {
                    location.href = `/show?users=${users.join(",").toLowerCase()}`
                }}
                disabled={users.length === 0}
            >
                この人たちが見ているアニメ一覧を見る
            </button>
        </div>
    )
}

createRoot(document.getElementById("app")!).render(<App />)
