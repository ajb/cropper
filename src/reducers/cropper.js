import { produce } from 'immer'
import { map, each, values, sortBy } from 'lodash'
import { intersect } from 'mathjs'
import { nextNameInSequence, sortAlphabetically } from '../utilities'

const initialState = {
  step: 'uploadImage', // drawGrid, imageReview, etc...
  image: {
    base64: null,
    width: null,
    height: null
  },
  scale: 1,
  lines: {
    // {
    //   type: 'line'
    //   id: lineId,
    //   points: [[startX, startY], [finishX, finishY]],
    //   added: Date.now(),
    //   name: ''
    // }
  },
  rects: {
    // {
    //   type: 'rect'
    //   id
    //   location
    //   size
    // }
  },
  intersections: [
    // {
    //   type: 'intersection'
    //   name: 'A1'
    //   location: [x, y]
    //   lineIds: ['line-1', 'line-2']
    //   rectId: 'rect-1',
    //   review: true/false
    //   size: ...
    // }
  ],
  clickToDrawLine: false,
  clickToDrawRect: false,
  wasDrawing: null,
  drawingLineId: null,
  sidebarLineId: null,
  drawingRectId: null,
  sidebarRectId: null,
  imageReview: {
    reviewingIdx: 0
  }
}

// Action Creators:

export function calculateIntersections() {
  return (dispatch, getState) => {
    const allLines = sortAlphabetically(values(getState().cropper.lines).slice(), 'name')
    const allRects = sortBy(values(getState().cropper.rects).slice(), 'added')

    const intersections = []

    while(allLines.length) {
      let checkingLine = allLines.shift()

      each(allLines, (otherLine) => {
        let res = intersect(
          [
            checkingLine.points[0][0],
            checkingLine.points[0][1]
          ],
          [
            checkingLine.points[1][0],
            checkingLine.points[1][1]
          ],
          [
            otherLine.points[0][0],
            otherLine.points[0][1]
          ],
          [
            otherLine.points[1][0],
            otherLine.points[1][1]
          ]
        )

        if (
          res &&
          res[0] < getState().cropper.image.width &&
          res[1] < getState().cropper.image.height &&
          res[0] > 0 &&
          res[1] > 0
        ) {
          intersections.push({
            type: 'intersection',
            location: [Math.round(res[0]), Math.round(res[1])],
            lineIds: [checkingLine.id, otherLine.id]
          })
        }
      })
    }

    while(allRects.length) {
      let rect = allRects.shift()
      let width = Math.abs(rect.points[0][0] - rect.points[1][0])
      let height = Math.abs(rect.points[0][1] - rect.points[1][1])
      let size = Math.max(width, height)

      let x = rect.points[0][0] + (width / 2)
      let y = rect.points[0][1] + (height / 2)

      intersections.push({
        type: 'intersection',
        location: [Math.round(x), Math.round(y)],
        size: size,
        rectId: rect.id
      })
    }

    dispatch({
      type: 'cropper/setIntersections',
      payload: intersections
    })

    return Promise.resolve()
  }
}

// Reducer:

export default function cropper(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'cropper/returnToDrawGrid':
      draft.step = 'drawGrid'
      draft.intersections = initialState.intersections
      draft.imageReview = initialState.imageReview
      return draft

      case 'cropper/restoreState':
      return action.payload

      case 'cropper/setClickToDraw':
      draft.clickToDraw = action.payload
      return draft

      case 'cropper/setStep':
      draft.step = action.payload
      return draft

      case 'cropper/createLine':
      draft.lines[action.meta.lineId] = {
        ...action.payload,
        type: 'line'
      }

      return draft

      case 'cropper/createRect':
      draft.rects[action.meta.rectId] = {
        ...action.payload,
        type: 'rect'
      }
      return draft

      case 'cropper/removeLine':
      delete draft.lines[action.payload]
      return draft

      case 'cropper/removeRect':
      delete draft.rects[action.payload]
      return draft

      case 'cropper/startDrawingLine':
      draft.drawingLineId = action.meta.lineId
      return draft

      case 'cropper/startDrawingRect':
      draft.drawingRectId = action.meta.rectId
      return draft

      case 'cropper/stopDrawing':
      draft.drawingLineId = null
      draft.drawingRectId = null
      return draft

      case 'cropper/setIntersections':
      draft.intersections = action.payload
      return draft

      case 'cropper/setLineFinish':
      draft.lines[action.meta.lineId].points = [
        draft.lines[action.meta.lineId].points[0],
        action.payload
      ]
      return draft

      case 'cropper/setRectFinish':
      draft.rects[action.meta.rectId].points = [
        draft.rects[action.meta.rectId].points[0],
        action.payload
      ]
      return draft

      case 'cropper/finishLine':
      // I don't know what this is, but it doesn't matter lol
      let maybeSlope = (
        action.payload.points[1][1] - action.payload.points[0][1]) /
        (action.payload.points[1][0] - action.payload.points[0][0]
      )

      draft.lines[action.meta.lineId].name = nextNameInSequence(Math.abs(maybeSlope) > 1 ? 'alphabetical' : 'numeric', map(state.lines, 'name'))

      // Replace points:
      draft.lines[action.meta.lineId].points = action.payload.points

      // Edit in sidebar:
      draft.sidebarLineId = action.meta.lineId

      // Set "wasDrawing" so we can add another
      draft.wasDrawing = 'line'
      return draft

      case 'cropper/finishRect':
      // Edit in sidebar:
      draft.sidebarRectId = action.meta.rectId

      // Set "wasDrawing" so we can add another
      draft.wasDrawing = 'rect'
      return draft

      case 'cropper/drawAnother':
      draft.wasDrawing = null
      draft.clickToDraw = state.wasDrawing
      return draft

      case 'cropper/loadImage':
      draft.image = action.payload
      return draft

      case 'cropper/setScale':
      draft.scale = action.payload
      return draft

      case 'cropper/editLineInSidebar':
      draft.sidebarLineId = action.meta.lineId
      return draft

      case 'cropper/editRectInSidebar':
      draft.sidebarRectId = action.meta.rectId
      return draft

      case 'cropper/closeSidebar':
      draft.sidebarLineId = null
      draft.sidebarRectId = null
      return draft

      case 'cropper/setLineName':
      draft.lines[action.meta.lineId].name = action.payload
      return draft

      case 'cropper/setRectName':
      draft.rects[action.meta.rectId].name = action.payload
      return draft

      case 'cropper/reviewImage':
      draft.intersections[draft.imageReview.reviewingIdx].review = action.payload
      return draft

      case 'cropper/reviewChangeSize':
      draft.intersections[draft.imageReview.reviewingIdx].size = parseInt(action.payload, 10)
      return draft

      case 'cropper/reviewPrevious':
      if (draft.imageReview.reviewingIdx > 0) {
        draft.imageReview.reviewingIdx = draft.imageReview.reviewingIdx - 1
      }
      return draft

      case 'cropper/reviewNext':
      if (draft.imageReview.reviewingIdx < draft.intersections.length - 1) {
        draft.imageReview.reviewingIdx = draft.imageReview.reviewingIdx + 1
      }
      return draft

      default:
      return draft
    }
  })
}
