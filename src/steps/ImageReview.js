import React, { useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Stage, Layer, Image, Rect } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import { filter, each } from 'lodash'
import { FlexContainer, LeftColumn, RightColumn } from '../layout'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { DEFAULT_HOLD_IMAGE_SIZE, REVIEW_STAGE_SIZE } from '../constants'
import { getIntersectionName } from '../utilities'

export default function ImageReview() {
  let state = useSelector(s => s.cropper)
  let dispatch = useDispatch()
  let imageReviewState = useSelector(s => s.cropper.imageReview)
  const [konvaImage] = useImage(state.image.base64)
  const activeIntersection = state.intersections && state.intersections[imageReviewState.reviewingIdx]
  const previousIntersection = state.intersections[imageReviewState.reviewingIdx - 1]
  const imageSize = (
    (activeIntersection && activeIntersection.size) ||
    (previousIntersection && previousIntersection.size) ||
    DEFAULT_HOLD_IMAGE_SIZE
  )

  const logHold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: true
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  const logNotHold = useCallback(() => {
    dispatch({type: 'cropper/reviewChangeSize', payload: imageSize})

    dispatch({
      type: 'cropper/reviewImage',
      payload: false
    })

    dispatch({type: 'cropper/reviewNext'})
  }, [dispatch, imageSize])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'KeyH') {
        logHold()
      }

      if (e.code === 'KeyN') {
        logNotHold()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => { document.removeEventListener('keydown', handleKeyPress) }
  }, [logHold, logNotHold])

  function previousStep() {
    if (!window.confirm('Are you sure? You will lose your data from this review step.')) return;
    dispatch({type: 'cropper/returnToDrawGrid'})
  }

  function finish() {
    let holdIntersections = filter(state.intersections, (i) => i.review)
    let imageFiles = []

    each(holdIntersections, (i) => {
      let exportStageSize = i.size || DEFAULT_HOLD_IMAGE_SIZE
      let stage = new Konva.Stage({
        container: 'hiddenStageContainer',
        width: exportStageSize,
        height: exportStageSize
      });

      let layer = new Konva.Layer()

      let image = new Konva.Image({
        image: konvaImage,
        x: 0,
        y: 0,
        offsetX: i.location[0] - (exportStageSize / 2),
        offsetY: i.location[1] - (exportStageSize / 2)
      })

      layer.add(image)
      stage.add(layer)

      imageFiles.push({
        name: getIntersectionName(state.lines, state.rects, i),
        data: stage.toDataURL()
      })
    })

    let zip = new JSZip()
    let folder = zip.folder('cropper-export');
    each(imageFiles, ({name, data}) => {
      folder.file(`${name}.png`, data.split('base64,')[1], {base64: true})
    })
    zip.generateAsync({type:"blob"}).then(function(content) {
      saveAs(content, "cropper-export.zip");
    })
  }

  if (state.intersections.length === 0) {
    return <NoHolds previousStep={previousStep} />;
  }

  let offsetX = activeIntersection.location[0] - (REVIEW_STAGE_SIZE / 2)
  let offsetY = activeIntersection.location[1] - (REVIEW_STAGE_SIZE / 2)

  function handleDrag(e) {
    dispatch({
      type: 'cropper/handleReviewDrag',
      payload: [e.target.x(), e.target.y()]
    })

    e.target.x(0)
    e.target.y(0)
  }

  return (
    <FlexContainer>
      <LeftColumn sticky={true}>
        <div>
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewPrevious'})}>Prev</span>
          &nbsp;
          <span className='link' onClick={() => dispatch({type: 'cropper/reviewNext'})}>Next</span>
        </div>

        Reviewing {imageReviewState.reviewingIdx + 1} of {state.intersections.length}

        <div>
          <button onClick={logHold}><u>H</u>old</button>
          <button onClick={logNotHold}><u>N</u>ot hold</button>

          <div>
            <label>Size</label>
            <input
              type='range'
              min={0}
              max={1000}
              value={imageSize}
              onChange={(e) => dispatch({type: 'cropper/reviewChangeSize', payload: e.target.value})}
            />
          </div>
        </div>

        <div>
          <div>Location: [{activeIntersection.location.join(',')}]</div>
          <div>Name: {getIntersectionName(state.lines, state.rects, activeIntersection)}</div>
          <div>Set as: {activeIntersection.review ? 'Hold' : 'Not hold'}</div>
          <div>Size: {imageSize}</div>
        </div>

        <div className='pt4'>
          <button onClick={previousStep}>Back</button>
          <button onClick={finish}>Finish</button>
        </div>
      </LeftColumn>
      <RightColumn>
        <div id='hiddenStageContainer' style={{display: 'none'}} />

        <Stage
          width={REVIEW_STAGE_SIZE}
          height={REVIEW_STAGE_SIZE}
        >
          <Layer>
            <Image
              image={konvaImage}
              offsetX={offsetX}
              offsetY={offsetY}
              draggable={true}
              onDragEnd={handleDrag}
            />

            <Rect
              x={REVIEW_STAGE_SIZE / 2}
              y={REVIEW_STAGE_SIZE / 2}
              offsetX={imageSize / 2}
              offsetY={imageSize / 2}
              width={imageSize}
              height={imageSize}
              fill='red'
              opacity={0.2}
            />

            <Rect
              x={REVIEW_STAGE_SIZE / 2}
              y={REVIEW_STAGE_SIZE / 2}
              offsetX={3}
              offsetY={3}
              width={6}
              height={6}
              fill='blue'
            />
          </Layer>
        </Stage>
      </RightColumn>
    </FlexContainer>
  )
}

export function NoHolds({previousStep}) {
  return (
    <p className='h3 gray'>No holds found. <span className='link' onClick={previousStep}>Go back</span></p>
  )
}
