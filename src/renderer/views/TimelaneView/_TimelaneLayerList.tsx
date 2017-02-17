import * as _ from 'lodash'
import * as React from 'react'
import {PropTypes} from 'react'
import classnames from 'classnames'
import * as Delir from 'delir-core'

import {ContextMenu, MenuItem} from '../electron/context-menu'
import RendererService from '../../services/renderer'
import EditorStateActions from '../../actions/editor-state-actions'
import ProjectModifyActions from '../../actions/project-modify-actions'
import TimelaneHelper from '../../helpers/timelane-helper'
import connectToStores from '../../utils/connectToStores'
import {default as EditorStateStore, EditorState} from '../../stores/editor-state-store'
import cancelEvent from '../../utils/cancelEvent'

import TimelaneLayer from './_TimelaneLayer'
import LaneKeyframes from '../timeline/lane-keyframes'

interface TimelaneLayerListProps {
    editor: EditorState,
    timelane: Delir.Project.Timelane,
    activeLayer: Delir.Project.Layer,
    framerate: number,
    scale: number,
}

interface TimelaneLayerListState {
    dragovered: boolean,
    pxPerSec: number,
}

/**
 * ClipSpace
 */
@connectToStores([EditorStateStore], context => ({
    editor: EditorStateStore.getState(),
}))
export default class TimelaneLayerList extends React.Component<TimelaneLayerListProps, TimelaneLayerListState>
{
    static propTypes = {
        editor: PropTypes.object.isRequired,
        timelane: PropTypes.object.isRequired,
        framerate: PropTypes.number.isRequired,
        scale: PropTypes.number.isRequired,
        activeLayer: PropTypes.object.isRequired,
    }

    _plugins: {id: string, packageName: string}[]

    constructor()
    {
        super()

        this._plugins = RendererService.pluginRegistry.getPlugins().map(entry => ({
            id: entry.id,
            packageName: entry.package.name
        }))

        this.state = {
            dragovered: false,
            pxPerSec: 30,
        }
    }

    onDrop = (e: React.DragEvent<HTMLLIElement>) =>
    {
        const {dragEntity, activeComp} = this.props.editor

        if (!activeComp || !dragEntity) return

        if (dragEntity.type === 'asset') {
            const {asset} = dragEntity
            const {state:{pxPerSec}, props:{framerate, scale}} = this
            const placedFrame = TimelaneHelper.pixelToFrames({pxPerSec, framerate, pixel: ((e.nativeEvent as any).layerX as number), scale})
            ProjectModifyActions.createLayerWithAsset(this.props.timelane, asset, placedFrame)
        }
        else if (dragEntity.type === 'layer') {
            const {layer} = dragEntity
            const isChildLayer = !! _.find(Array.from(this.props.timelane.layers.values()), {id: layer.id})

            if (isChildLayer) {
                const placedFrame = TimelaneHelper.pixelToFrames({
                    pxPerSec: this.state.pxPerSec,
                    framerate: this.props.framerate,
                    pixel: e.pageX - e.currentTarget.getBoundingClientRect().left - (e.nativeEvent as DragEvent).offsetX,
                    scale: this.props.scale,
                })
                ProjectModifyActions.modifyLayer(dragEntity.layer.id!, {placedFrame: placedFrame})
            } else {
                ProjectModifyActions.moveLayerToTimelane(layer.id!, this.props.timelane.id!)
            }
        } else {
            return
        }

        EditorStateActions.clearDragEntity()
        this.setState({dragovered: false})
    }

    onDragLeave(e)
    {
        this.setState({dragovered: false})
    }

    onDragOver(e)
    {
        this.setState({dragovered: true})
    }

    changeLayerPlace(layer, movedX)
    {
    }

    addNewLayer = (layerRendererId) =>
    {
        ProjectModifyActions.createLayer(this.props.timelane.id!, layerRendererId, 0, 100)
    }

    render()
    {
        const {timelane, activeLayer, framerate, scale} = this.props
        const {pxPerSec} = this.state
        const keyframes = activeLayer ? activeLayer.keyframes : {}
        const layers = Array.from<Delir.Project.Layer>(timelane.layers.values())
        const plugins = this._plugins

        const tmpKey = keyframes ? Object.keys(keyframes)[1] : ''

        return (
            <li
                className={classnames('timeline-lane', {
                    dragover: this.state.dragovered,
                    '--expand': layers.findIndex(layer => !!(activeLayer && layer.id === activeLayer.id)) !== -1,
                })}
                data-lane-id={timelane.id}
                onDragOver={this.onDragOver.bind(this)}
                onDragLeave={this.onDragLeave.bind(this)}
                onDrop={this.onDrop}
            >
                <ContextMenu>
                    <MenuItem type='separator' />
                    <MenuItem label='Add new Layer' enabled={!!plugins.length}>
                        {_.map(plugins, p =>
                            <MenuItem label={p.packageName} onClick={this.addNewLayer.bind(null, p.id)} />
                        )}
                    </MenuItem>
                    <MenuItem type='separator' />
                </ContextMenu>

                <div className='timeline-lane-layers'>
                    {layers.map(layer => {
                        const opt = {
                            pxPerSec: pxPerSec,
                            framerate: framerate,
                            scale: scale,
                        };
                        const width = TimelaneHelper.framesToPixel({
                            durationFrames: layer.durationFrames|0,
                            ...opt,
                        })
                        const left = TimelaneHelper.framesToPixel({
                            durationFrames: layer.placedFrame|0,
                            ...opt,
                        })

                        return (
                            <TimelaneLayer
                                key={layer.id!}
                                layer={layer}
                                width={width}
                                left={left}
                                onChangePlace={this.changeLayerPlace.bind(this, layer)}
                            />
                        )
                    })}
                </div>
                <LaneKeyframes keyframes={keyframes && keyframes[tmpKey] ? keyframes[tmpKey] : []} pxPerSec={pxPerSec} />
            </li>
        )
    }
}