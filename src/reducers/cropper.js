import { produce } from 'immer'
import { each, values } from 'lodash'
import { intersect } from 'mathjs'

const initialState = {
  step: 'uploadImage', // drawGrid, imageReview, etc...
  image: {
    base64: null,
    width: null,
    height: null
  },
  scale: 1,
  lines: {},
  intersections: [],
  clickToDrawLine: false,
  drawingLineId: null,
  sidebarLineId: null,
  imageReview: {
    reviewingIdx: 0
  }
}

// Action Creators:

export function calculateIntersections() {
  return (dispatch, getState) => {
    const allLines = values(getState().cropper.lines).slice()
    const intersections = []

    while(allLines.length) {
      let checkingLine = allLines.pop();

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
            location: [Math.round(res[0]), Math.round(res[1])],
            lineIds: [checkingLine.id, otherLine.id]
          })
        }
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
      case 'cropper/restoreState':
      return action.payload

      case 'cropper/setClickToDrawLine':
      draft.clickToDrawLine = action.payload
      return draft

      case 'cropper/setStep':
      draft.step = action.payload
      return draft

      case 'cropper/createLine':
      draft.lines[action.meta.lineId] = action.payload
      return draft

      case 'cropper/removeLine':
      delete draft.lines[action.payload]
      return draft

      case 'cropper/startDrawing':
      draft.drawingLineId = action.meta.lineId
      return draft

      case 'cropper/stopDrawing':
      draft.drawingLineId = null
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

      case 'cropper/replaceLinePoints':
      draft.lines[action.meta.lineId].points = action.payload
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

      case 'cropper/closeSidebar':
      draft.sidebarLineId = null
      return draft

      case 'cropper/setLineName':
      draft.lines[action.meta.lineId].name = action.payload
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
