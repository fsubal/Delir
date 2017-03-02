import {Component, PropTypes} from 'react'
import * as Delir from 'delir-core'

import TimelaneHelper from '../../helpers/timelane-helper'
import RendererService from '../../services/renderer'

import s from './Gradations.styl'

interface GradationsProps {
    activeComposition: Delir.Project.Composition|null,
    cursorHeight: number,
    scale: number
}

export default class Gradations extends Component<GradationsProps, any>
{
    static propTypes = {
        activeComposition: PropTypes.object.isRequired,
        cursorHeight: PropTypes.number.isRequired,
        scale: PropTypes.number.isRequired,
    }

    intervalId = null

    state = {
        left: 0,
    }

    componentDidMount()
    {
        this.intervalId = requestAnimationFrame(this.updateCursor)
    }

    componentWillUnmount()
    {
        cancelAnimationFrame(this.intervalId)
    }

    updateCursor = () =>
    {
        const {activeComposition, scale} = this.props

        if (comp && renderer.isPlaying) {
            this.setState({
                left: TimelaneHelper.framesToPixel({
                    pxPerSec: 30,
                    framerate: activeComposition.framerate,
                    durationFrames: RendererService.renderer.session.lastRenderedFrame,
                    scale: this.props.scale,
                }),
            })
        }

        this.intervalId = requestAnimationFrame(this.updateCursor)
    }

    render()
    {
        return (
            <div className={s.Gradations}>
                <div className={s.playingCursor} style={{
                    left: this.state.left,
                    height: this.props.cursorHeight
                }} />
            </div>
        )
    }
}