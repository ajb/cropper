import { produce } from 'immer'

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
