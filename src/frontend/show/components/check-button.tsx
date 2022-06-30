import React, { useId } from "react"
import "./check-button.css"

export const CheckButton: React.FC<JSX.IntrinsicElements["input"]> = props => {
    const id = useId()

    return (
        <>
            <input
                {...{
                    ...props,
                    children: undefined,
                }}
                type="checkbox"
                id={id}
                className="check-button-input"
            />
            <label htmlFor={id}>{props.children}</label>
        </>
    )
}
