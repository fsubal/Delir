import Delir from 'delir-core'
const {Helper: DelirHelper, Project} = Delir

import dispatcher from '../dispatcher'
import ActionTypes from '../action-types'

export default {
    //
    // Modify project
    //

    // TODO: frame position
    moveLayerToTimelane(layerId: string, targetTimelaneId: string)
    {
        dispatcher.dispatch({
            type: ActionTypes.MOVE_LAYER_TO_TIMELINE,
            payload: {layerId, targetTimelaneId},
        })
    },

    changeCompositionName(compId: string, newName: string)
    {
        // dispatcher.dispatch({
        //     type: 'change-composition-name',
        //     payload: {compId, newName}
        // })
    },

    createComposition({name, width, height, framerate})
    {
        const composition = new Project.Composition
        composition.name = name
        composition.width = width
        composition.height = height
        composition.framerate = framerate

        dispatcher.dispatch({
            type: ActionTypes.CREATE_COMPOSTION,
            payload: {composition},
        })
    },

    createTimelane(compId: string)
    {
        const timelane = new Project.TimeLane

        dispatcher.dispatch({
            type: ActionTypes.CREATE_TIMELANE,
            payload: {timelane, targetCompositionId: compId}
        })
    },

    createLayer(timelaneId: string, placedFrame = 0, durationFrame = 100)
    {
        const layer = new Project.Layer
        layer.placedFrame = placedFrame
        layer.durationFrame = durationFrame

        dispatcher.dispatch({
            type: ActionTypes.CREATE_LAYER,
            payload: {
                layer,
                targetTimelaneId: timelaneId,
            },
        })
    },
}
