import React from "react"

import { ViewsShowData } from "../../page-types/show.js"

export const ViewsShow: React.FC<ViewsShowData> = props => {
    return (
        <html>
            <head>
                <meta charSet="UTF-8" />
                <link rel="stylesheet" href="/wp-content/themes/sanime/show.css" />
                <link rel="preconnect" href="https://s4.anilist.co" />
                <link rel="preconnect" href="https://image.annict.com" />
                <link rel="preload" type="script" href="/wp-content/themes/sanime/show.js" />
            </head>
            <body>
                <div id="app">
                    <script
                        id="page-data"
                        type="application/json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify(props).replaceAll(
                                "<",
                                "\\u" + "<".charCodeAt(0).toString().padStart(4, "0"),
                            ),
                        }}
                    />
                </div>
                <script src="/wp-content/themes/sanime/show.js" />
            </body>
        </html>
    )
}
