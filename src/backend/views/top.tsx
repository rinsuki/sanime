import React from "react"

export const ViewsTop: React.FC = () => {
    return (
        <html>
            <head>
                <meta charSet="UTF-8" />
                <link rel="stylesheet" href="/wp-content/themes/sanime/top.css" />
                <link rel="preload" type="script" href="/wp-content/themes/sanime/top.js" />
            </head>
            <body>
                <h1>sanime</h1>
                <p>
                    みんなが見たアニメ一覧をまとめて見れるやつです。
                    <a href="https://github.com/rinsuki/sanime">GitHub</a>
                </p>
                <div id="app">読み込み中………</div>
                <script src="/wp-content/themes/sanime/top.js" />
            </body>
        </html>
    )
}
