import React, { useState } from "react"
import "./cool-thumbnail.css"
import { useInView } from "react-intersection-observer"

export const CoolThumbnail: React.FC<{ className: string; lazy: boolean; src: string }> = props => {
    // なんか Safari も Firefox も loading=lazy の挙動がまだまだ微妙なので自前で実装する
    const [showImage, setShowImage] = useState(!props.lazy)
    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: "2000px 0px",
    })
    if (inView && !showImage) setShowImage(true)

    const src = showImage ? props.src : undefined

    return (
        <div className={`cool-thumbnail ${props.className}`} ref={ref}>
            <img src={src} data-src={props.src} />
            <img src={src} data-src={props.src} />
        </div>
    )
}
