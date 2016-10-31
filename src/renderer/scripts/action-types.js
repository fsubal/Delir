import keyMirror from 'keyMirror'

export default keyMirror({
    // EditorStateActions
    SET_ACTIVE_PROJECT: null,
    CHANGE_ACTIVE_COMPOSITION: null,
    CHANGE_ACTIVE_LAYER: null,

    TOGGLE_PREVIEW: null,
    DESTINATE_PROJECT: null,

    // ProjectModifyActions
    HISTORY_PUSH: null, // {undo: Function, redo: Funcion}
    HISTORY_UNDO: null,
    HISTORY_REDO: null,
})
