import * as _ from 'lodash'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as classnames from 'classnames'
import * as Delir from 'delir-core'

import TimePixelConversion from '../../utils/TimePixelConversion'

import AppActions from '../../actions/App'
import ProjectModActions from '../../actions/ProjectMod'

import * as s from './KeyframeGraph.styl'

interface Props {
    width: number
    height: number
    viewBox: string
    scrollLeft: number
    composition: Delir.Project.Composition
    clip: Delir.Project.Clip,
    propName: string,
    descriptor?: Delir.AnyParameterTypeDescriptor
    keyframes: Delir.Project.Keyframe[]
    pxPerSec: number
    zoomScale: number
}

interface State {
    activeKeyframeId: string|null
    keyframeMovement: {x: number}|null
    easingHandleMovement: {x: number, y: number}|null
}

export default class KeyframeGraph extends React.Component<Props, State> {
    protected static propTypes = {
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        viewBox: PropTypes.string.isRequired,
        scrollLeft: PropTypes.number.isRequired,
        composition: PropTypes.instanceOf(Delir.Project.Composition).isRequired,
        clip: PropTypes.instanceOf(Delir.Project.Clip).isRequired,
        propName: PropTypes.string.isRequired,
        descriptor: PropTypes.instanceOf(Delir.TypeDescriptor),
        keyframes: PropTypes.arrayOf(PropTypes.instanceOf(Delir.Project.Keyframe)).isRequired,
        pxPerSec: PropTypes.number.isRequired,
        zoomScale: PropTypes.number.isRequired,
    }

    public state: State = {
        activeKeyframeId: null,
        keyframeMovement: null,
        easingHandleMovement: null,
    }

    private _selectedKeyframeId: string|null = null
    private _initialKeyframePosition: {x: number, y: number}|null = null
    private _keyframeDragged: boolean = false

    private _selectedEasingHandleHolderData: {
        type: 'ease-in'|'ease-out',
        keyframeId: string,
        element: SVGCircleElement,
        container: SVGGElement,
        initialPosition: {x: number, y: number},
    }|null = null

    private mouseMoveOnSvg = (e: React.MouseEvent<SVGElement>) =>
    {
        if (this._selectedKeyframeId) {
            this._keyframeDragged = true

            this.setState({
                keyframeMovement: {
                    x: e.screenX - this._initialKeyframePosition!.x,
                }
            })
        } else if (this._selectedEasingHandleHolderData) {
            this.setState({
                easingHandleMovement: {
                    x: e.screenX - this._selectedEasingHandleHolderData.initialPosition!.x,
                    y: e.screenY - this._selectedEasingHandleHolderData.initialPosition!.y,
                },
            })
        }
    }

    private mouseUpOnSvg = (e: React.MouseEvent<SVGElement>) =>
    {
        e.preventDefault()
        e.stopPropagation()

        const {clip, propName, keyframes} = this.props

        const {keyframeMovement} = this.state
        // if (!clip || !activePropName) return

        process: {
            if (this._selectedKeyframeId) {
                // Process for keyframe dragged
                if (!this._keyframeDragged) {
                    this.setState({activeKeyframeId: this._selectedKeyframeId, keyframeMovement: null})
                    break process
                }

                if (!keyframeMovement) break process

                const keyframe = keyframes.find(kf => kf.id === this._selectedKeyframeId)!
                const movedFrame = this._pxToFrame(keyframeMovement.x)

                ProjectModActions.createOrModifyKeyframeForClip(clip.id!, propName, keyframe.frameOnClip, {
                    frameOnClip: keyframe.frameOnClip + movedFrame
                })

            } else if (this._selectedEasingHandleHolderData) {
                // Process for easing handle dragged

                const data = this._selectedEasingHandleHolderData
                const transitionPath = this._selectedEasingHandleHolderData.container.querySelector('[data-transition-path]')!

                const keyframes = clip.keyframes[propName].slice(0).sort((a, b) => a.frameOnClip - b.frameOnClip)
                const keyframeIdx = keyframes.findIndex(kf => kf.id === this._selectedEasingHandleHolderData!.keyframeId)!
                if (keyframeIdx === -1) break process

                const {beginX, beginY, endX, endY} = _.mapValues<string, number>(transitionPath.dataset, val => parseFloat(val))
                const rect = {width: endX - beginX, height: endY - beginY}
                const position = {x: data.element.cx.baseVal.value, y: data.element.cy.baseVal.value}

                if (data.type === 'ease-in') {
                    ProjectModActions.createOrModifyKeyframeForClip(clip.id!, propName, keyframes[keyframeIdx + 1].frameOnClip, {
                        easeInParam: [(position.x - beginX) / rect.width, (position.y - beginY) / rect.height]
                    })
                } else if (data.type === 'ease-out') {
                    ProjectModActions.createOrModifyKeyframeForClip(clip.id!, propName, keyframes[keyframeIdx].frameOnClip, {
                        easeOutParam: [(position.x - beginX) / rect.width, (position.y - beginY) / rect.height]
                    })
                }
            }
        }

        // Clear dragging state
        this._selectedKeyframeId = null
        this._keyframeDragged = false
        this._selectedEasingHandleHolderData = null
        this.setState({
            keyframeMovement: null,
            easingHandleMovement: null,
        })
    }

    private keydownOnKeyframeGraph = (e: React.KeyboardEvent<SVGElement>) =>
    {
        const {activeKeyframeId} = this.state
        console.log(e)

        if ((e.key === 'Delete' || e.key === 'Backspace') && activeKeyframeId) {
            ProjectModActions.removeKeyframe(activeKeyframeId)
            this._selectedKeyframeId = null
        }
    }

    private mouseDownOnEasingHandle = (e: React.MouseEvent<SVGCircleElement>) =>
    {
        const {dataset} = e.currentTarget
        this._selectedEasingHandleHolderData = {
            type: dataset.isEaseIn ? 'ease-in' : 'ease-out',
            keyframeId: dataset.keyframeId,
            element: e.currentTarget,
            container: (e.currentTarget.parentElement! as any) as SVGGElement,
            initialPosition: {x: e.screenX, y: e.screenY}
        }
    }

    private mouseDownOnKeyframe = (e: React.MouseEvent<SVGGElement>) =>
    {
        this._selectedKeyframeId = e.currentTarget.dataset.keyframeId
        this._keyframeDragged = false
        this._initialKeyframePosition = {x: e.screenX, y: e.screenY}
    }

    private doubleClickOnKeyframe = ({currentTarget}: React.MouseEvent<SVGGElement>) =>
    {
        const {clip} = this.props
        if (!clip) return

        AppActions.seekPreviewFrame(clip.placedFrame + (currentTarget.dataset.frame | 0))
    }

    public render()
    {
        const {width, height, viewBox, descriptor} = this.props

        return (
            <svg
                className={s.keyframeGraph}
                viewBox={viewBox}
                width={width}
                height={height}
                onMouseMove={this.mouseMoveOnSvg}
                onMouseUp={this.mouseUpOnSvg}
                onKeyDown={this.keydownOnKeyframeGraph}
                tabIndex={-1}
            >
                {descriptor.animatable && this.renderKeyframes()}
            </svg>
        )
    }

    private renderKeyframes()
    {
        const {descriptor, keyframes} = this.props
        // const {activePropName} = this.state
        // const descriptor = this._getDescriptorByPropName(activePropName)

        // if (!clip || !activePropName || !clip!.keyframes[activePropName] || !descriptor) return []

        switch (descriptor.type) {
            case 'COLOR_RGB':
            case 'COLOR_RGBA':
                return this._renderColorKeyframes(keyframes)

            case 'FLOAT':
            case 'NUMBER':
                return this._renderNumberKeyframes(keyframes)

            case 'STRING':
                return this._renderStringKeyframes(keyframes)
        }
    }

    private _renderNumberKeyframes(keyframes: Delir.Project.Keyframe[])
    {
        const {keyframeMovement, easingHandleMovement} = this.state
        const points = this._buildKeyframePoints(keyframes)
        const NO_TRANSFORM = {x: 0, y: 0}
        const easingHandleHolderData = this._selectedEasingHandleHolderData

        return points.map((p, idx) => {
            const transform = (keyframeMovement && p.id === this._selectedKeyframeId) ? keyframeMovement : NO_TRANSFORM
            const easingHandleTransform = (easingHandleMovement && p.id === this._selectedEasingHandleHolderData!.keyframeId) ? easingHandleMovement : NO_TRANSFORM
            const easeOutHandleTransform = (easingHandleHolderData && easingHandleHolderData!.type === 'ease-out') ? easingHandleTransform : NO_TRANSFORM
            const easeInHandleTransform = (easingHandleHolderData && easingHandleHolderData!.type === 'ease-in') ? easingHandleTransform : NO_TRANSFORM

            return (
                <g key={p.id} data-index={idx}>
                    {p.transition && (
                        <path
                            stroke='#fff'
                            fill='none'
                            strokeWidth='1'
                            d={`
                                M ${p.transition.x} ${p.transition.y}
                                C ${p.transition.xh + easeOutHandleTransform.x} ${p.transition.yh + easeOutHandleTransform.y}
                                  ${p.transition.xxh + easeInHandleTransform.x} ${p.transition.yyh + easeInHandleTransform.y}
                                  ${p.transition.xx} ${p.transition.yy}
                            `}
                            data-begin-x={p.transition.x}
                            data-begin-y={p.transition.y}
                            data-end-x={p.transition.xx}
                            data-end-y={p.transition.yy}
                            data-transition-path
                        />
                    )}
                    {p.easeOutLine && (
                        <path
                            className={s.keyframeLineToHandle}
                            strokeWidth='1'
                            d={`
                                M ${p.easeOutLine.x} ${p.easeOutLine.y}
                                L ${p.easeOutLine.xx + easeOutHandleTransform.x} ${p.easeOutLine.yy + easeOutHandleTransform.y}
                            `}
                            data-ease-out-handle-path
                        />
                    )}
                    {p.nextEaseInLine && (
                        <path
                            className={s.keyframeLineToHandle}
                            strokeWidth='1'
                            d={`
                                M ${p.nextEaseInLine.x} ${p.nextEaseInLine.y}
                                L ${p.nextEaseInLine.xx + easeInHandleTransform.x} ${p.nextEaseInLine.yy + easeInHandleTransform.y}
                            `}
                            data-ease-in-handle-path
                        />
                    )}
                    <g
                        transform={`translate(${p.point.x + transform.x - 4} ${p.point.y - 4})`}
                        onDoubleClick={this.doubleClickOnKeyframe}
                        onMouseDown={this.mouseDownOnKeyframe}
                        onMouseUp={this.mouseUpOnSvg}
                        data-keyframe-id={p.id}
                        data-frame={p.frame}
                    >
                        <rect className={classnames(s.keyframeInner, {
                            [s['keyframeInner--selected']]: p.id === this.state.activeKeyframeId
                        })} width='8' height='8'  />
                    </g>
                    {p.nextEaseInHandle && (
                        <circle
                            cx={p.nextEaseInHandle.x + easeInHandleTransform.x}
                            cy={p.nextEaseInHandle.y + easeInHandleTransform.y}
                            fill='#7100bf'
                            r='4'
                            onMouseDown={this.mouseDownOnEasingHandle}
                            onMouseUp={this.mouseUpOnSvg}
                            data-keyframe-id={p.id}
                            data-is-ease-in
                        />
                    )}
                    {p.easeOutHandle && (
                        <circle
                            cx={p.easeOutHandle.x + easeOutHandleTransform.x}
                            cy={p.easeOutHandle.y + easeOutHandleTransform.y}
                            fill='#7100bf'
                            r='4'
                            onMouseDown={this.mouseDownOnEasingHandle}
                            onMouseUp={this.mouseUpOnSvg}
                            data-keyframe-id={p.id}
                            data-is-ease-out
                        />
                    )}
                </g>
            )
        }).reverse()
    }

    private _renderColorKeyframes(keyframes: Delir.Project.Keyframe[])
    {
        const {clip, height: graphHeight} = this.props
        const {scrollLeft} = this.props
        const halfHeight = graphHeight / 2

        if (!clip) return []

        const clipPlacedPositionX = this._frameToPx(clip.placedFrame) - scrollLeft

        return keyframes.slice(0).sort((a, b) => a.frameOnClip - b.frameOnClip).map((kf, idx) => {
            const x = clipPlacedPositionX + this._frameToPx(kf.frameOnClip)
            const nextX = keyframes[idx + 1] ? clipPlacedPositionX + this._frameToPx(keyframes[idx + 1].frameOnClip) : null
            const transform = (this.state.keyframeMovement && kf.id === this._selectedKeyframeId) ? this.state.keyframeMovement : {x: 0}

            return (
                <g ref={kf.id}>
                    {nextX != null && (
                        <path
                            stroke='#fff'
                            fill='none'
                            strokeWidth='1'
                            d={`M ${x + 4} ${halfHeight + 4} L ${nextX - 4} ${halfHeight + 4}`}
                        />
                    )}
                    <g
                        className={classnames(s.keyframe, s['keyframe--color'])}
                        transform={`translate(${x + transform.x - 4} ${halfHeight})`}
                        onDoubleClick={this.doubleClickOnKeyframe}
                        onMouseDown={this.mouseDownOnKeyframe}
                        onMouseUp={this.mouseUpOnSvg}
                        data-keyframe-id={kf.id}
                        data-frame={kf.frameOnClip}
                    >
                        <rect
                            className={classnames(s.keyframeInner, {
                                [s['keyframeInner--selected']]: kf.id === this.state.activeKeyframeId
                            })}
                            width='8'
                            height='8'
                            stroke='#fff'
                            strokeWidth='1'
                            style={{fill: (kf.value as Delir.ColorRGBA).toString()}}
                        />
                    </g>
                </g>
            )
        })
    }

    private _renderStringKeyframes(keyframes: Delir.Project.Keyframe[])
    {
        const {clip, scrollLeft, height} = this.props
        const halfHeight = height / 2

        if (!clip) return []
        const clipPlacedPositionX = this._frameToPx(clip.placedFrame) - scrollLeft

        return keyframes.slice(0).sort((a, b) => a.frameOnClip - b.frameOnClip).map((kf, idx) => {
            const x = clipPlacedPositionX + this._frameToPx(kf.frameOnClip)
            const nextX = keyframes[idx + 1] ? clipPlacedPositionX + this._frameToPx(keyframes[idx + 1].frameOnClip) : null
            const transform = (this.state.keyframeMovement && kf.id === this._selectedKeyframeId) ? this.state.keyframeMovement : {x: 0}

            return (
                <g ref={kf.id}>
                    {nextX != null && (
                        <path
                            stroke='#fff'
                            fill='none'
                            strokeWidth='1'
                            d={`M ${x + 4} ${halfHeight + 4} L ${nextX - 4} ${halfHeight + 4}`}
                        />
                    )}
                    <g
                        transform={`translate(${x + transform.x - 4} ${halfHeight})`}
                        onDoubleClick={this.doubleClickOnKeyframe}
                        onMouseDown={this.mouseDownOnKeyframe}
                        onMouseUp={this.mouseUpOnSvg}
                        data-keyframe-id={kf.id}
                        data-frame={kf.frameOnClip}
                    >
                        <rect
                            className={classnames(s.keyframeInner, {
                                [s['keyframeInner--selected']]: kf.id === this.state.activeKeyframeId
                            })}
                            width='8'
                            height='8'
                            fill='#fff'
                        />
                    </g>
                </g>
            )
        })
    }

    private _frameToPx(frame: number): number
    {
        const {pxPerSec, zoomScale, composition} = this.props

        return TimePixelConversion.framesToPixel({
            pxPerSec,
            framerate: composition!.framerate,
            durationFrames: frame,
            scale: zoomScale,
        })
    }

    private _pxToFrame(x: number): number
    {
        // const {props: {pxPerSec, scale, editor: {activeComp}}} = this
        const {pxPerSec, zoomScale, composition} = this.props

        return TimePixelConversion.pixelToFrames({
            framerate: composition!.framerate,
            pixel: x,
            pxPerSec,
            scale: zoomScale,
        })
    }

    private _buildKeyframePoints = (keyframes: Delir.Project.Keyframe[]): {
        id: string,
        frame: number,
        point: {x: number, y: number},
        hasNextKeyframe: boolean,
        transition: {x: number, y: number, xh: number, yh: number, xxh: number, yyh: number, xx: number, yy: number}|null,
        easeOutLine: {x: number, y: number, xx: number, yy: number}|null,
        nextEaseInLine: {x: number, y: number, xx: number, yy: number}|null,
        easeOutHandle: {x: number, y: number}|null,
        nextEaseInHandle: {x: number, y: number}|null,
    }[] =>
    {
        const {clip, descriptor, height, scrollLeft} = this.props

        if (!descriptor || descriptor.animatable === false) return []

        const orderedKeyframes = keyframes.slice(0).sort((a, b) => a.frameOnClip - b.frameOnClip)
        const clipPlacedPositionX = this._frameToPx(clip.placedFrame)

        if (descriptor.type === 'NUMBER' || descriptor.type === 'FLOAT') {
            const maxValue = orderedKeyframes.reduce((memo, kf, idx, list) => {
                // const prev = list[idx - 1]
                // const next = list[idx + 1]
                // const prevValue = (prev && kf.easeInParam[1] > 1) ? (prev.value as number) * kf.easeInParam[1] : -Infinity
                // const nextValue = (next && kf.easeOutParam[1] > 1) ? (next.value as number) * kf.easeOutParam[1] : -Infinity

                return Math.max(memo, kf.value as number) // , prevValue, nextValue)
            }, -Infinity) + 10
            const minValue = orderedKeyframes.reduce((memo, kf, idx, list) => {
                // const prev = list[idx - 1]
                // const next = list[idx + 1]
                // const prevValue = (prev && kf.easeInParam[1] < 0) ? (prev.value as number) * kf.easeInParam[1] : +Infinity
                // const nextValue = (next && kf.easeOutParam[1] < 0) ? (next.value as number) * kf.easeOutParam[1] : +Infinity

                return Math.min(memo, kf.value as number) // , prevValue, nextValue)
            }, +Infinity) + -10
            const absMinValue = Math.abs(minValue)
            const minMaxRange = maxValue - minValue

            // Calc keyframe and handle points
            return orderedKeyframes.map((keyframe, idx) => {
                // const previousKeyframe: Delir.Project.Keyframe|undefined = orderedKeyframes[idx - 1]
                const nextKeyframe: Delir.Project.Keyframe|undefined = orderedKeyframes[idx + 1]

                // let previousX = 0
                // let previousY = 0
                let nextX = 0
                let nextY = 0
                let handleEoX = 0
                let handleEoY = 0
                // let handleEiX = 0
                // let handleEiY = 0
                let nextKeyframeEiX = 0
                let nextKeyframeEiY = 0

                const beginX = clipPlacedPositionX + this._frameToPx(keyframe.frameOnClip) - scrollLeft
                const beginY = height - height * (((keyframe.value as number) - minValue) / minMaxRange)

                if (nextKeyframe) {
                    // Next keyframe position
                    nextX = clipPlacedPositionX + this._frameToPx(nextKeyframe.frameOnClip) - scrollLeft
                    nextY = height - height * (((nextKeyframe.value as number) - minValue) / minMaxRange)

                    // Handle of control transition to next keyframe
                    handleEoX = ((nextX - beginX) * keyframe.easeOutParam[0]) + beginX
                    handleEoY = ((nextY - beginY) * keyframe.easeOutParam[1]) + beginY // ((endPointY - beginY) * nextKeyframe.easeOutParam[1]) + beginY

                    nextKeyframeEiX = ((nextX - beginX) * nextKeyframe.easeInParam[0]) + beginX
                    nextKeyframeEiY = ((nextY - beginY) * nextKeyframe.easeInParam[1]) + beginY
                }

                return {
                    id: keyframe.id,
                    frame: keyframe.frameOnClip,
                    point: {x: beginX, y: beginY},
                    hasNextKeyframe: !!nextKeyframe,
                    transition: nextKeyframe ? {x: beginX, y: beginY, xh: handleEoX, yh: handleEoY, xxh: nextKeyframeEiX, yyh: nextKeyframeEiY, xx: nextX, yy: nextY} : null,
                    easeOutLine: nextKeyframe ? {x: beginX, y: beginY, xx: handleEoX, yy: handleEoY} : null,
                    nextEaseInLine: nextKeyframe ? {x: nextX, y: nextY, xx: nextKeyframeEiX, yy: nextKeyframeEiY} : null,
                    easeOutHandle: nextKeyframe ? {x: handleEoX, y: handleEoY} : null,
                    nextEaseInHandle: nextKeyframe ? {x: nextKeyframeEiX, y: nextKeyframeEiY} : null,
                }
            })
        }

        return []
    }
}
